# Alerta de leads sin actividad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avisar (notificación in-app) cuando un lead abierto lleva N días sin actividad, con N configurable desde el modal de Configuración (default 4).

**Architecture:** Mismo patrón que `tarea_vencida`/`ticket_post_venta_vencido`: columna flag anti-spam en `leads`, función `security definer` corrida por `pg_cron` cada hora, trigger que resetea el flag cuando hay actividad nueva. El umbral de días vive en una tabla de config global nueva (`configuracion_alertas`), editable solo por `dueña` desde `ConfiguracionModal.vue`.

**Tech Stack:** Nuxt 3, Supabase (Postgres + RLS + pg_cron).

## Global Constraints

- Sin suite de tests automatizada — verificación es `npm run build` + SQL manual vía `mcp__supabase__execute_sql` + prueba en navegador (la hace el usuario).
- No reutilizar `configuracion_archivado` (su CHECK de `modulo` es un enum cerrado de módulos de archivado, semánticamente distinto).
- El aviso va a `coalesce(owner_id, created_by)` del lead, nunca a otro usuario.
- Spec completo: `docs/superpowers/specs/2026-07-19-leads-inactividad-alerta-design.md`.

---

## Task 1: Migración — columna, triggers de actividad, tabla de config, permiso

**Files:**
- Create: `supabase/migrations/20260719010000_leads_inactividad_config.sql`

**Interfaces:**
- Produces: `leads.notificado_inactividad boolean`; tabla `configuracion_alertas(clave text primary key, valor integer)` con fila `('leads_inactividad_dias', 4)`; permiso `configuracion_alertas.edit` (otorgado a `dueña`).

- [ ] **Step 1: Escribir el archivo de migración**

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

- [ ] **Step 2: Aplicar la migración**

Usar `mcp__supabase__apply_migration` con `name: "leads_inactividad_config"` y el mismo `query` del Step 1.

- [ ] **Step 3: Verificar**

```sql
select column_name from information_schema.columns
where table_name = 'leads' and column_name = 'notificado_inactividad';

select clave, valor from configuracion_alertas;

select has_permission(
  (select id from profiles p join profile_roles pr on pr.user_id = p.id join roles r on r.id = pr.role_id where r.name = 'dueña' limit 1),
  'configuracion_alertas', 'edit'
);
```

Expected: la columna existe; `configuracion_alertas` tiene la fila `('leads_inactividad_dias', 4)`; `has_permission(...)` devuelve `true` para un usuario con rol `dueña`. Si no hay ningún usuario con rol `dueña` en la base de prueba, saltar la tercera verificación (no es bloqueante).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260719010000_leads_inactividad_config.sql
git commit -m "$(cat <<'EOF'
feat: add lead inactivity tracking columns, triggers and config

Adds notificado_inactividad flag to leads (anti-spam for the
inactivity cron in the next task), a trigger that bumps leads.updated_at
when a lead_interaccion is inserted (interactions now count as
activity), a trigger that resets the flag when new activity happens,
and a new configuracion_alertas table for the global days-of-inactivity
threshold (default 4), editable only by the dueña.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migración — tipo de notificación `lead_inactivo` + cron

**Files:**
- Create: `supabase/migrations/20260719020000_notificacion_leads_inactivos.sql`

**Interfaces:**
- Consumes: `configuracion_alertas` y `leads.notificado_inactividad` de Task 1.
- Produces: función `fn_notificar_leads_inactivos()`; cron job `notificar-leads-inactivos` (hora en hora); `notificaciones.tipo` acepta `'lead_inactivo'`.

- [ ] **Step 1: Escribir el archivo de migración**

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

- [ ] **Step 2: Aplicar la migración**

Usar `mcp__supabase__apply_migration` con `name: "notificacion_leads_inactivos"` y el mismo `query` del Step 1.

- [ ] **Step 3: Prueba funcional end-to-end de la función**

```sql
-- Tomar un lead abierto real, forzarlo a "viejo" y correr la función a mano.
select id, nombre, estado, archivado, updated_at, notificado_inactividad
from leads
where estado not in ('ganado', 'perdido') and not archivado
limit 1;

-- (usar el id devuelto arriba en los dos statements siguientes)
update leads set updated_at = now() - interval '10 days' where id = '<ID_DEL_LEAD>';

select fn_notificar_leads_inactivos();

select tipo, titulo, mensaje, entidad_id from notificaciones
where entidad_id = '<ID_DEL_LEAD>' and tipo = 'lead_inactivo';

select notificado_inactividad from leads where id = '<ID_DEL_LEAD>';
```

Expected: aparece una fila en `notificaciones` con `tipo = 'lead_inactivo'`; `leads.notificado_inactividad` quedó en `true`. Correr `select fn_notificar_leads_inactivos();` una segunda vez y confirmar que NO se duplica la fila en `notificaciones` (flag anti-spam funcionando).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260719020000_notificacion_leads_inactivos.sql
git commit -m "$(cat <<'EOF'
feat: notify lead owners when a lead goes inactive

Cron job (hourly, same cadence as tarea_vencida) that flags open,
non-archived leads whose updated_at is older than the configured
threshold and inserts a lead_inactivo notification for the owner.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `useConfiguracionAlertas.ts` (composable nuevo)

**Files:**
- Create: `app/composables/useConfiguracionAlertas.ts`

**Interfaces:**
- Consumes: tabla `configuracion_alertas` de Task 1.
- Produces: `fetchDiasInactividadLeads(): Promise<number>`; `actualizarDiasInactividadLeads(dias: number): Promise<void>`.

- [ ] **Step 1: Escribir el composable**

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

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: compila sin error (composable nuevo, sin consumidores todavía — Task 4 lo conecta).

- [ ] **Step 3: Commit**

```bash
git add app/composables/useConfiguracionAlertas.ts
git commit -m "$(cat <<'EOF'
feat: add useConfiguracionAlertas composable

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `ConfiguracionModal.vue` — campo de días de inactividad

**Files:**
- Modify: `app/components/shared/ConfiguracionModal.vue`

**Interfaces:**
- Consumes: `useConfiguracionAlertas()` de Task 3; `usePermissions().can('configuracion_alertas', 'edit')`.

- [ ] **Step 1: Agregar imports y estado**

En el `<script setup>`, después de la línea `const { fetchConfiguracion, actualizarDias } = useConfiguracionArchivado()`, agregar:

```ts
const { fetchDiasInactividadLeads, actualizarDiasInactividadLeads } = useConfiguracionAlertas()
const { can } = usePermissions()
```

Después de `const mostrarArchivado = computed(...)`, agregar:

```ts
const mostrarInactividadLeads = computed(() => can('configuracion_alertas', 'edit'))
const diasInactividadLeads = ref(4)
```

- [ ] **Step 2: Cargar el valor al abrir el modal**

Dentro del `watch(() => props.open, async (abierto) => { ... })` existente, después del bloque `if (mostrarArchivado.value) { ... }`, agregar:

```ts
    if (mostrarInactividadLeads.value) {
      diasInactividadLeads.value = await fetchDiasInactividadLeads()
    }
```

- [ ] **Step 3: Validar y guardar**

En `onGuardar`, la línea de validación actual:

```ts
  if (mostrarArchivado.value && (diasLeads.value < 1 || diasTickets.value < 1 || diasPostVenta.value < 1)) return
```

pasa a:

```ts
  if (mostrarArchivado.value && (diasLeads.value < 1 || diasTickets.value < 1 || diasPostVenta.value < 1)) return
  if (mostrarInactividadLeads.value && diasInactividadLeads.value < 1) return
```

Y dentro del `try`, después del bloque `if (mostrarArchivado.value) { await Promise.all([...]) }`, agregar:

```ts
    if (mostrarInactividadLeads.value) {
      await actualizarDiasInactividadLeads(diasInactividadLeads.value)
    }
```

- [ ] **Step 4: Agregar la sección al template**

Después del `<div v-if="mostrarArchivado" ...>...</div>` existente (el bloque de días de archivado), agregar:

```vue
    <div v-if="mostrarInactividadLeads" class="mt-4 pt-4 border-t border-border">
      <label class="block text-xs font-medium text-ink-muted mb-1">
        Avisar leads sin actividad después de (días)
      </label>
      <input
        v-model.number="diasInactividadLeads"
        type="number"
        min="1"
        class="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
      />
    </div>
```

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: `✨ Build complete!` sin errores.

- [ ] **Step 6: Commit**

```bash
git add app/components/shared/ConfiguracionModal.vue
git commit -m "$(cat <<'EOF'
feat: add lead inactivity threshold field to Configuración modal

Visible only to accounts with configuracion_alertas.edit (dueña),
independent of the archival-days section (which stays gated to
post_venta).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `NotificationBell.vue` + `useNotificaciones.ts` — mostrar el aviso

**Files:**
- Modify: `app/composables/useNotificaciones.ts:5-6`
- Modify: `app/components/shared/NotificationBell.vue:17-25`

**Interfaces:**
- Consumes: `notificaciones.tipo = 'lead_inactivo'` de Task 2.

- [ ] **Step 1: Ampliar el union type**

En `app/composables/useNotificaciones.ts:5-6`, reemplazar:

```ts
  tipo: 'lead_asignado' | 'ticket_asignado' | 'tarea_asignada' | 'tarea_vencida'
      | 'capacitacion_asignada' | 'capacitacion_vencida' | 'ticket_post_venta_vencido'
```

por:

```ts
  tipo: 'lead_asignado' | 'ticket_asignado' | 'tarea_asignada' | 'tarea_vencida'
      | 'capacitacion_asignada' | 'capacitacion_vencida' | 'ticket_post_venta_vencido'
      | 'lead_inactivo'
```

- [ ] **Step 2: Agregar el ícono**

En `app/components/shared/NotificationBell.vue:17-25`, agregar una línea al objeto `etiquetaTipo`:

```ts
  ticket_post_venta_vencido: '🛠️',
  lead_inactivo: '⚠️',
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: `✨ Build complete!` sin errores de tipos (el `Record<Notificacion['tipo'], string>` de `etiquetaTipo` exige que todos los valores del union type estén cubiertos — si falta `lead_inactivo` en el mapa, TypeScript debe marcar error acá, confirmando que el Step 2 es obligatorio).

- [ ] **Step 4: Commit**

```bash
git add app/composables/useNotificaciones.ts app/components/shared/NotificationBell.vue
git commit -m "$(cat <<'EOF'
feat: show lead_inactivo notifications in the bell

No routing changes needed - entidad_tipo 'lead' already maps to
/leads in rutaEntidad.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Verificación manual (usuario)

**Files:** ninguno — checklist de prueba en navegador, la ejecuta el usuario.

- [ ] **Step 1: Pasar la lista de verificación al usuario**

Avisar que están listos para probar, siguiendo el checklist del spec
(`docs/superpowers/specs/2026-07-19-leads-inactividad-alerta-design.md`,
sección "Testing"):

1. Como `dueña`: abrir Configuración, cambiar "Avisar leads sin actividad después de (días)" a un valor, guardar, reabrir el modal — el valor persiste.
2. Como usuario sin `configuracion_alertas.edit` (ej. `ventas`): abrir Configuración — el campo de días de inactividad no aparece.
3. Editar un lead abierto o agregarle una interacción — la campanita no debe mostrar un aviso de inactividad para ese lead en la próxima hora (su actividad se acaba de resetear).
4. Confirmar en la campanita, cuando corresponda (o vía la prueba SQL manual de Task 2 Step 3), que el ícono ⚠️ aparece y que hacer click en la notificación navega a `/leads/{id}`.
