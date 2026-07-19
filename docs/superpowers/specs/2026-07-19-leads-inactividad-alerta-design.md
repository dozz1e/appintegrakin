# Alerta de leads sin actividad

## Contexto

Se pide avisar cuando un lead lleva N días sin actividad (default 4),
con N configurable desde el modal de Configuración. El proyecto ya
tiene el patrón exacto para esto: notificaciones "vencidas" vía
`pg_cron` con flag anti-spam (`tarea_vencida`/`notificada_vencida`,
`ticket_post_venta_vencido`) y un config global de días editable en
`ConfiguracionModal.vue` (`configuracion_archivado`, gateado por
permiso).

Estado relevante (código real, revisado):
- `leads`: `estado` (`nuevo|contactado|cotizado|negociacion|ganado|perdido`),
  `owner_id`, `created_by`, `updated_at` (default `now()`, se bump
  explícito en cada `updateLead`, incluido el cambio de estado del
  Kanban vía `cambiarEstado`), `archivado`, `fecha_cierre`.
- `lead_interacciones`: NO tiene trigger que toque `leads.updated_at`
  al insertar — una conversación registrada hoy no cuenta como
  "actividad" para efectos de `updated_at`.
- `configuracion_archivado(modulo text primary key check (modulo in
  ('leads','tickets','tickets_post_venta')), dias integer)` — el CHECK
  es un enum cerrado de módulos de archivado; **no** se reutiliza para
  este feature (mezclaría "días para archivar" con "días de
  inactividad" bajo el mismo nombre y modulo, y el CHECK ni siquiera
  lo permitiría sin migrar el constraint).
- `notificaciones.tipo` tiene un CHECK cerrado (`lead_asignado`,
  `ticket_asignado`, `tarea_asignada`, `tarea_vencida`,
  `capacitacion_asignada`, `capacitacion_vencida`,
  `ticket_post_venta_vencido`) — hay que agregar `lead_inactivo`.
- `NotificationBell.vue`: mapa `etiquetaTipo` (emoji por tipo) +
  `rutaEntidad` (`lead` → `/leads`, ya cubre este caso sin cambios).

## Diseño

### Migración 1 — columna, trigger de actividad, config, permiso

```sql
-- supabase/migrations/20260719010000_leads_inactividad_config.sql

alter table leads add column notificado_inactividad boolean not null default false;

-- Una interacción registrada cuenta como actividad: bump updated_at.
-- El trigger de leads (más abajo) resetea notificado_inactividad
-- cuando detecta que updated_at cambió, así que no hace falta
-- resetear el flag acá también.
create or replace function fn_bump_lead_actividad()
returns trigger
language plpgsql
security definer
as $$
begin
  update leads set updated_at = now() where id = new.lead_id;
  return new;
end;
$$;

create trigger trg_lead_interaccion_actividad
  after insert on lead_interacciones
  for each row execute function fn_bump_lead_actividad();

-- Resetea el aviso apenas hay actividad nueva (edición o interacción,
-- ambas bumpean updated_at). Mismo patrón que
-- fn_resetear_notificada_vencida, pero disparado por updated_at en
-- vez de por fecha_vencimiento/completada.
create or replace function fn_resetear_notificado_inactividad()
returns trigger
language plpgsql
as $$
begin
  if old.notificado_inactividad and new.updated_at is distinct from old.updated_at then
    new.notificado_inactividad := false;
  end if;
  return new;
end;
$$;

create trigger trg_resetear_notificado_inactividad before update on leads
  for each row execute function fn_resetear_notificado_inactividad();

-- Config global (no por usuario) de días de inactividad antes de avisar.
create table configuracion_alertas (
  clave text primary key,
  valor integer not null check (valor > 0)
);

insert into configuracion_alertas (clave, valor) values ('leads_inactividad_dias', 4);

alter table configuracion_alertas enable row level security;

create policy select_configuracion_alertas on configuracion_alertas
for select using (auth.uid() is not null);

create policy update_configuracion_alertas on configuracion_alertas
for update using (has_permission(auth.uid(), 'configuracion_alertas', 'edit'));

insert into permissions (resource, action) values
  ('configuracion_alertas', 'edit')
on conflict (resource, action) do nothing;

do $$
declare
  r_id uuid;
  p_id uuid;
begin
  select id into r_id from roles where name = 'dueña';
  if r_id is not null then
    select p.id into p_id from permissions p where p.resource = 'configuracion_alertas' and p.action = 'edit';
    if p_id is not null then
      insert into role_permissions (role_id, permission_id) values (r_id, p_id) on conflict do nothing;
    end if;
  end if;
end $$;
```

### Migración 2 — tipo de notificación + cron

```sql
-- supabase/migrations/20260719020000_notificacion_leads_inactivos.sql

alter table notificaciones drop constraint notificaciones_tipo_check;
alter table notificaciones add constraint notificaciones_tipo_check
  check (tipo = any (array[
    'lead_asignado', 'ticket_asignado', 'tarea_asignada', 'tarea_vencida',
    'capacitacion_asignada', 'capacitacion_vencida', 'ticket_post_venta_vencido',
    'lead_inactivo'
  ]));

create or replace function fn_notificar_leads_inactivos()
returns void
language plpgsql
security definer
as $$
declare
  v_dias integer;
begin
  select valor into v_dias from configuracion_alertas where clave = 'leads_inactividad_dias';
  if v_dias is null then v_dias := 4; end if;

  with inactivos as (
    update leads
    set notificado_inactividad = true
    where estado not in ('ganado', 'perdido')
      and not archivado
      and updated_at < now() - (v_dias || ' days')::interval
      and not notificado_inactividad
      and coalesce(owner_id, created_by) is not null
    returning id, nombre, coalesce(owner_id, created_by) as destinatario
  )
  insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
  select destinatario, 'lead_inactivo', 'Lead sin actividad', nombre, 'lead', id
  from inactivos;
end;
$$;

select cron.schedule(
  'notificar-leads-inactivos',
  '0 * * * *',
  $$select fn_notificar_leads_inactivos()$$
);
```

### `useConfiguracionAlertas.ts` (composable nuevo)

```ts
// composables/useConfiguracionAlertas.ts

export const useConfiguracionAlertas = () => {
  const supabase = useSupabaseClient()

  const fetchDiasInactividadLeads = async (): Promise<number> => {
    const { data, error } = await supabase
      .from('configuracion_alertas')
      .select('valor')
      .eq('clave', 'leads_inactividad_dias')
      .single()
    if (error) throw error
    return data.valor
  }

  const actualizarDiasInactividadLeads = async (dias: number) => {
    const { error } = await supabase
      .from('configuracion_alertas')
      .update({ valor: dias })
      .eq('clave', 'leads_inactividad_dias')
    if (error) throw error
  }

  return { fetchDiasInactividadLeads, actualizarDiasInactividadLeads }
}
```

### `ConfiguracionModal.vue`

- Nuevo `const { can } = usePermissions()` y
  `const mostrarInactividadLeads = computed(() => can('configuracion_alertas', 'edit'))`
  (independiente de `mostrarArchivado`, que sigue atado a `post_venta`).
- Nuevo `const diasInactividadLeads = ref(4)`, cargado en el mismo
  `watch(() => props.open, ...)` cuando `mostrarInactividadLeads.value`
  es true (`fetchDiasInactividadLeads()`).
- Nueva sección en el template, con el mismo estilo que la de
  archivado (`border-t`, label + input numérico `min="1"`), visible
  solo si `mostrarInactividadLeads`.
- `onGuardar`: si `mostrarInactividadLeads.value`, valida
  `diasInactividadLeads.value >= 1` y llama
  `actualizarDiasInactividadLeads(diasInactividadLeads.value)` junto
  con los `Promise.all` existentes.

### `NotificationBell.vue`

- `etiquetaTipo` gana `lead_inactivo: '⚠️'`.
- `rutaEntidad` no cambia (`lead` → `/leads` ya cubre la navegación).
- `useNotificaciones.ts`: el tipo `Notificacion['tipo']` (union type)
  gana `'lead_inactivo'`.

## Fuera de alcance

- No se notifica por email, solo in-app (mismo criterio que el resto
  de notificaciones del sistema).
- No hay umbral por usuario/rol — un solo valor global, igual que
  `configuracion_archivado`.
- No se toca el Kanban de leads ni se agrega ningún indicador visual
  de "inactivo" en la lista — solo la notificación.
- Clientes/tickets sin actividad quedan fuera (se pidió específicamente
  leads).

## Testing (manual, sin suite automatizada)

1. Bajar el umbral a 1 día desde Configuración (requiere rol `dueña`),
   esperar/forzar que un lead abierto tenga `updated_at` viejo, correr
   `select fn_notificar_leads_inactivos();` a mano en el SQL editor —
   debe aparecer la notificación en la campanita del `owner_id` del
   lead.
2. Confirmar que un lead `ganado`/`perdido`/`archivado` con
   `updated_at` viejo NO genera notificación.
3. Correr la función una segunda vez sin cambios — no debe duplicar la
   notificación (flag `notificado_inactividad`).
4. Agregar una interacción a ese lead (o editarlo) y volver a correr la
   función — no debe notificar de nuevo todavía (se resetió el flag,
   pero `updated_at` ahora es reciente, no cruza el umbral).
5. Un usuario sin permiso `configuracion_alertas.edit` (ej. rol
   `ventas`) NO ve el campo de días de inactividad en el modal de
   Configuración.
6. La dueña cambia el valor a 7 días, guarda, recarga el modal — el
   valor persiste.
