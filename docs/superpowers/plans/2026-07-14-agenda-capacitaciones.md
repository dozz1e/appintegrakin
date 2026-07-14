# Agenda de Capacitaciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un módulo de agenda para el rol `capacitaciones`: citas de capacitación con clientes sobre un producto del catálogo, con notificación al asignar y recordatorio igual al que ya existe para tareas.

**Architecture:** Tabla propia `citas_capacitacion` (mismo patrón RLS que `tareas`/`ventas`: `owner_id` + `view_all`), reutiliza la infraestructura ya existente de `notificaciones` (trigger + `pg_cron`) y del popup `RecordatorioAlert` (se generaliza para mezclar dos fuentes). Página nueva `/capacitaciones` con lista + filtro de fecha + modal de alta/edición.

**Tech Stack:** Nuxt 4 / Vue 3 / Supabase (Postgres + RLS + `pg_cron`) — mismo stack que el resto del repo, sin librerías nuevas.

## Global Constraints

- Sin `owner_id` en `productos` (catálogo compartido) — el selector de producto en el formulario usa `useProductos().fetchProductos()` filtrado a `estado === 'activo'`, sin filtro de permisos adicional.
- Un cliente por cita, sin recurrencia, sin hora de fin (spec: `docs/superpowers/specs/2026-07-14-agenda-capacitaciones-design.md`).
- Sin policy de `delete` en `citas_capacitacion` — "eliminar" es marcar `estado = 'cancelada'`.
- Sin permiso `capacitaciones.edit` separado — editar lo decide `owner_id`/`view_all` en la policy de `update`.
- **No hay suite de tests automatizada en este proyecto** (confirmado: sin `vitest`/`jest`, sin archivos `*.test.*`/`*.spec.*`). La verificación de cada tarea es manual: consultas SQL directas para migraciones (vía `mcp__supabase__execute_sql`) y prueba en navegador para UI, con `rm -rf .nuxt && npm run dev` después de crear composables/componentes nuevos (gotcha #2 de `CONTEXTO_PROYECTO.md`).
- Los emails de prueba disponibles y sus roles actuales: `informatica@integrakin.cl` (rol `marketing`), `o.molina@integrakin.cl` (superadmin, sin rol de negocio). Ninguno de los dos tiene hoy el rol `capacitaciones` — Task 1 debe crear o asignar uno para poder probar.

---

### Task 1: Migración — tabla `citas_capacitacion` + RLS + permisos

**Files:**
- Create: `supabase/migrations/20260714050000_citas_capacitacion.sql`

**Interfaces:**
- Produces: tabla `citas_capacitacion(id, cliente_id, producto_id, titulo, notas, fecha_hora, estado, owner_id, created_by, notificada_vencida, created_at, updated_at)`, permisos `capacitaciones.view`/`.view_all`/`.create` en la tabla `permissions`, asignados a los roles `dueña` (los 3) y `capacitaciones` (`view`+`create`).

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260714050000_citas_capacitacion.sql
--
-- Agenda de capacitaciones: citas con clientes externos sobre un producto
-- puntual del catálogo. Ver spec 2026-07-14-agenda-capacitaciones-design.md.
-- Mismo patrón de RLS que `tareas` (owner_id + view_all, sin permiso .edit
-- separado). Sin policy de delete: "eliminar" es marcar estado='cancelada'.

create table citas_capacitacion (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  producto_id uuid not null references productos(id),
  titulo text not null,
  notas text,
  fecha_hora timestamptz not null,
  estado text check (estado in ('pendiente','completada','cancelada')) not null default 'pendiente',
  owner_id uuid references profiles(id),
  created_by uuid references profiles(id),
  notificada_vencida boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_citas_capacitacion_owner on citas_capacitacion(owner_id) where estado = 'pendiente';
create index idx_citas_capacitacion_cliente on citas_capacitacion(cliente_id);

alter table citas_capacitacion enable row level security;

create policy select_citas_capacitacion on citas_capacitacion
for select using (
  owner_id = auth.uid()
  or has_permission(auth.uid(), 'capacitaciones', 'view_all')
);

create policy insert_citas_capacitacion on citas_capacitacion
for insert with check (
  created_by = auth.uid()
  and has_permission(auth.uid(), 'capacitaciones', 'create')
);

create policy update_citas_capacitacion on citas_capacitacion
for update using (
  owner_id = auth.uid()
  or has_permission(auth.uid(), 'capacitaciones', 'view_all')
);

insert into permissions (resource, action) values
  ('capacitaciones', 'view'), ('capacitaciones', 'view_all'), ('capacitaciones', 'create')
on conflict (resource, action) do nothing;

do $$
declare
  r_id uuid;
  p_id uuid;
  matriz jsonb := '{
    "dueña":          ["capacitaciones.view_all","capacitaciones.create"],
    "capacitaciones": ["capacitaciones.view","capacitaciones.create"]
  }';
  rol text;
  perm text;
begin
  for rol in select jsonb_object_keys(matriz) loop
    select id into r_id from roles where name = rol;
    if r_id is null then continue; end if;
    for perm in select jsonb_array_elements_text(matriz->rol) loop
      select p.id into p_id from permissions p
        where p.resource = split_part(perm, '.', 1) and p.action = split_part(perm, '.', 2);
      if p_id is not null then
        insert into role_permissions (role_id, permission_id) values (r_id, p_id)
        on conflict do nothing;
      end if;
    end loop;
  end loop;
end $$;
```

- [ ] **Step 2: Aplicar la migración**

Aplicar con `mcp__supabase__apply_migration` (`name: "citas_capacitacion"`, `query`: el contenido de arriba).

Expected: `{"success": true}`.

- [ ] **Step 3: Verificar permisos y RLS**

Ejecutar con `mcp__supabase__execute_sql`:

```sql
select r.name, p.resource, p.action
from role_permissions rp
join roles r on r.id = rp.role_id
join permissions p on p.id = rp.permission_id
where p.resource = 'capacitaciones'
order by r.name, p.action;
```

Expected: 4 filas — `capacitaciones` con `create`/`view`, `dueña` con `create`/`view_all`.

- [ ] **Step 4: Asignar el rol `capacitaciones` a una cuenta de prueba**

```sql
insert into profile_roles (profile_id, role_id)
select p.id, r.id from profiles p, roles r
where p.email = 'informatica@integrakin.cl' and r.name = 'capacitaciones'
on conflict do nothing;
```

Expected: permite probar el flujo completo con esa cuenta más adelante (Task 10).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260714050000_citas_capacitacion.sql
git commit -m "feat: agregar tabla citas_capacitacion con RLS y permisos"
```

---

### Task 2: Migración — tabla `citas_descartadas`

**Files:**
- Create: `supabase/migrations/20260714060000_citas_descartadas.sql`

**Interfaces:**
- Consumes: tabla `citas_capacitacion(id)` (Task 1).
- Produces: tabla `citas_descartadas(user_id, cita_id, created_at)` con RLS.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260714060000_citas_descartadas.sql
--
-- Descarte del popup RecordatorioAlert para citas de capacitación, mismo
-- patrón que tareas_descartadas (20260714010000).

create table citas_descartadas (
  user_id uuid not null references profiles(id),
  cita_id uuid not null references citas_capacitacion(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, cita_id)
);

alter table citas_descartadas enable row level security;

create policy select_citas_descartadas on citas_descartadas
for select using (user_id = auth.uid());

create policy insert_citas_descartadas on citas_descartadas
for insert with check (user_id = auth.uid());

create policy delete_citas_descartadas on citas_descartadas
for delete using (user_id = auth.uid());
```

- [ ] **Step 2: Aplicar la migración**

`mcp__supabase__apply_migration` (`name: "citas_descartadas"`).

Expected: `{"success": true}`.

- [ ] **Step 3: Verificar la tabla existe**

```sql
select table_name from information_schema.tables where table_name = 'citas_descartadas';
```

Expected: 1 fila.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260714060000_citas_descartadas.sql
git commit -m "feat: agregar tabla citas_descartadas para el popup de recordatorio"
```

---

### Task 3: Migración — notificación al asignar responsable

**Files:**
- Create: `supabase/migrations/20260714070000_notificacion_capacitacion_asignada.sql`

**Interfaces:**
- Consumes: tabla `notificaciones(user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)` (ya existe), `citas_capacitacion` (Task 1).
- Produces: trigger `trg_notificar_capacitacion_asignada` — al insertar una cita con `owner_id` distinto de `created_by`, inserta una notificación `tipo='capacitacion_asignada'`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260714070000_notificacion_capacitacion_asignada.sql
--
-- Mismo patrón que fn_notificar_tarea_asignada (ver
-- 20260702000600.../notificaciones existentes): notifica al responsable
-- cuando se le asigna una cita que no creó él mismo.
--
-- notificaciones_tipo_check no incluye los tipos nuevos de esta feature
-- (bug detectado en implementación real: el brief original solo tenía el
-- trigger, sin esta ALTER TABLE, y el insert fallaba con constraint
-- violation). Se agregan aquí los dos valores que usa todo el módulo
-- (capacitacion_asignada en este archivo, capacitacion_vencida en el cron
-- de Task 4) para no tocar esta tabla dos veces.
alter table notificaciones drop constraint notificaciones_tipo_check;
alter table notificaciones add constraint notificaciones_tipo_check
  check (tipo in ('lead_asignado','ticket_asignado','tarea_asignada','tarea_vencida','capacitacion_asignada','capacitacion_vencida'));

create or replace function fn_notificar_capacitacion_asignada()
returns trigger
language plpgsql
security definer
as $$
declare
  v_cliente text;
begin
  if new.owner_id is not null and new.owner_id != new.created_by then
    select razon_social into v_cliente from clientes where id = new.cliente_id;
    insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
    values (new.owner_id, 'capacitacion_asignada', 'Capacitación asignada', v_cliente, 'cliente', new.cliente_id);
  end if;
  return new;
end;
$$;

create trigger trg_notificar_capacitacion_asignada after insert on citas_capacitacion
  for each row execute function fn_notificar_capacitacion_asignada();
```

- [ ] **Step 2: Aplicar la migración**

`mcp__supabase__apply_migration` (`name: "notificacion_capacitacion_asignada"`).

Expected: `{"success": true}`.

- [ ] **Step 3: Verificar el trigger dispara**

```sql
-- usa un cliente y producto reales existentes, y dos profiles.id distintos
-- para created_by/owner_id (ajustar los uuid según los datos reales del
-- proyecto antes de correr esto)
insert into citas_capacitacion (cliente_id, producto_id, titulo, fecha_hora, owner_id, created_by)
select c.id, p.id, 'Prueba trigger', now() + interval '1 day',
       (select id from profiles where email = 'o.molina@integrakin.cl'),
       (select id from profiles where email = 'informatica@integrakin.cl')
from clientes c, productos p limit 1
returning id;

select tipo, titulo, mensaje from notificaciones
where entidad_tipo = 'cliente' and tipo = 'capacitacion_asignada'
order by created_at desc limit 1;
```

Expected: la segunda consulta devuelve 1 fila con `tipo = 'capacitacion_asignada'`. Borrar la fila de prueba después:
```sql
delete from citas_capacitacion where titulo = 'Prueba trigger';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260714070000_notificacion_capacitacion_asignada.sql
git commit -m "feat: notificar al asignar responsable de una capacitacion"
```

---

### Task 4: Migración — cron de citas vencidas

**Files:**
- Create: `supabase/migrations/20260714080000_notificacion_citas_vencidas.sql`

**Interfaces:**
- Consumes: `citas_capacitacion` (Task 1), `notificaciones` (existente).
- Produces: función `fn_notificar_citas_vencidas()`, cron job `notificar-citas-vencidas` (cada hora), trigger `trg_resetear_notificada_vencida_citas` que resetea `notificada_vencida` al reprogramar o reabrir.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260714080000_notificacion_citas_vencidas.sql
--
-- Mismo patrón que fn_notificar_tareas_vencidas
-- (20260710000000_notificacion_tarea_vencida.sql): "vencer" no es un evento
-- de escritura, se revisa por cron.
--
-- notificaciones_tipo_check ya incluye 'capacitacion_vencida' — se agregó
-- en la migración de Task 3 (20260714070000) junto con
-- 'capacitacion_asignada', no hace falta otra ALTER TABLE acá.

create or replace function fn_notificar_citas_vencidas()
returns void
language plpgsql
security definer
as $$
begin
  with vencidas as (
    update citas_capacitacion
    set notificada_vencida = true
    where fecha_hora < now()
      and estado = 'pendiente'
      and not notificada_vencida
      and owner_id is not null
    returning id, cliente_id, owner_id
  )
  insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
  select v.owner_id, 'capacitacion_vencida', 'Capacitación vencida', c.razon_social, 'cliente', v.cliente_id
  from vencidas v join clientes c on c.id = v.cliente_id;
end;
$$;

select cron.schedule(
  'notificar-citas-vencidas',
  '0 * * * *',
  $$select fn_notificar_citas_vencidas()$$
);

create or replace function fn_resetear_notificada_vencida_citas()
returns trigger
language plpgsql
as $$
begin
  if old.notificada_vencida
     and (new.fecha_hora is distinct from old.fecha_hora
          or (old.estado != 'pendiente' and new.estado = 'pendiente')) then
    new.notificada_vencida := false;
  end if;
  return new;
end;
$$;

create trigger trg_resetear_notificada_vencida_citas before update on citas_capacitacion
  for each row execute function fn_resetear_notificada_vencida_citas();
```

- [ ] **Step 2: Aplicar la migración**

`mcp__supabase__apply_migration` (`name: "notificacion_citas_vencidas"`).

Expected: `{"success": true}`.

- [ ] **Step 3: Verificar la función y el cron job existen**

```sql
select jobname, schedule from cron.job where jobname = 'notificar-citas-vencidas';
```

Expected: 1 fila, `schedule = '0 * * * *'`.

- [ ] **Step 4: Probar la función manualmente**

```sql
insert into citas_capacitacion (cliente_id, producto_id, titulo, fecha_hora, owner_id, created_by)
select c.id, p.id, 'Prueba vencida', now() - interval '2 hours',
       (select id from profiles where email = 'informatica@integrakin.cl'),
       (select id from profiles where email = 'informatica@integrakin.cl')
from clientes c, productos p limit 1
returning id;

select fn_notificar_citas_vencidas();

select tipo, titulo from notificaciones where tipo = 'capacitacion_vencida' order by created_at desc limit 1;

delete from citas_capacitacion where titulo = 'Prueba vencida';
```

Expected: la tercera consulta devuelve 1 fila.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260714080000_notificacion_citas_vencidas.sql
git commit -m "feat: agregar cron de citas de capacitacion vencidas"
```

---

### Task 5: Extender notificaciones (tipos + iconos)

**Files:**
- Modify: `app/composables/useNotificaciones.ts`
- Modify: `app/components/shared/NotificationBell.vue`

**Interfaces:**
- Consumes: nada nuevo (solo extiende un union type existente).
- Produces: `Notificacion['tipo']` acepta `'capacitacion_asignada' | 'capacitacion_vencida'`.

- [ ] **Step 1: Extender el tipo en el composable**

En `app/composables/useNotificaciones.ts`, la interfaz actual es:

```ts
export interface Notificacion {
  id: string
  user_id: string
  tipo: 'lead_asignado' | 'ticket_asignado' | 'tarea_asignada' | 'tarea_vencida'
  titulo: string
  mensaje: string | null
  entidad_tipo: 'lead' | 'cliente' | 'ticket' | 'tarea'
  entidad_id: string
  leida: boolean
  created_at: string
}
```

Reemplazar la línea de `tipo` por:

```ts
  tipo: 'lead_asignado' | 'ticket_asignado' | 'tarea_asignada' | 'tarea_vencida'
      | 'capacitacion_asignada' | 'capacitacion_vencida'
```

- [ ] **Step 2: Agregar los iconos en `NotificationBell.vue`**

La constante actual:

```ts
const etiquetaTipo: Record<Notificacion['tipo'], string> = {
  lead_asignado: '🧲',
  ticket_asignado: '🎫',
  tarea_asignada: '✅',
  tarea_vencida: '⏰',
}
```

Reemplazar por:

```ts
const etiquetaTipo: Record<Notificacion['tipo'], string> = {
  lead_asignado: '🧲',
  ticket_asignado: '🎫',
  tarea_asignada: '✅',
  tarea_vencida: '⏰',
  capacitacion_asignada: '🎓',
  capacitacion_vencida: '⏰',
}
```

`rutaEntidad` no cambia — ya tiene `cliente: '/clientes'`, y ambos tipos nuevos usan `entidad_tipo = 'cliente'`.

- [ ] **Step 3: Verificar que no queda ningún `Record` incompleto**

```bash
grep -rn "Record<Notificacion\['tipo'\]" app/
```

Expected: solo la línea de `etiquetaTipo` en `NotificationBell.vue` (TypeScript fallaría el build si faltara una clave del union en ese `Record`, así que si el proyecto sigue arrancando sin errores de tipo, está completo).

- [ ] **Step 4: Commit**

```bash
git add app/composables/useNotificaciones.ts app/components/shared/NotificationBell.vue
git commit -m "feat: soportar notificaciones de capacitacion en la campanita"
```

---

### Task 6: Composable `useCitasCapacitacion.ts`

**Files:**
- Create: `app/composables/useCitasCapacitacion.ts`

**Interfaces:**
- Consumes: `useSupabaseClient()`, `useSupabaseUser()`, `useMiPerfil()` (para `settings.umbral_alertas_minutos`, igual que `useTareas.ts`), `useToast()`.
- Produces:
  - `interface CitaCapacitacion { id, cliente_id, producto_id, titulo, notas: string | null, fecha_hora, estado: 'pendiente'|'completada'|'cancelada', owner_id: string | null, created_by: string | null, created_at, updated_at }`
  - `interface CitaCapacitacionConNombres extends CitaCapacitacion { cliente_nombre: string; producto_nombre: string }`
  - `fetchCitas(): Promise<CitaCapacitacionConNombres[]>`
  - `crearCita(payload: { cliente_id, producto_id, titulo, notas, fecha_hora, owner_id? }): Promise<CitaCapacitacion>`
  - `actualizarCita(id: string, payload: Partial<Pick<CitaCapacitacion,'titulo'|'notas'|'fecha_hora'|'estado'|'owner_id'|'producto_id'|'cliente_id'>>): Promise<CitaCapacitacion>`
  - `citasProximas: Ref<CitaCapacitacionConNombres[]>` (useState compartido)
  - `refrescarCitasProximas(): Promise<void>`
  - `descartarCitaProxima(id: string): Promise<void>`
  - `cargarDescartadasGuardadas(): Promise<void>`

- [ ] **Step 1: Escribir el composable**

```ts
export type EstadoCita = 'pendiente' | 'completada' | 'cancelada'

export interface CitaCapacitacion {
  id: string
  cliente_id: string
  producto_id: string
  titulo: string
  notas: string | null
  fecha_hora: string
  estado: EstadoCita
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CitaCapacitacionConNombres extends CitaCapacitacion {
  cliente_nombre: string
  producto_nombre: string
}

const UMBRAL_MINUTOS_DEFAULT = 30

function mapearFila(fila: any): CitaCapacitacionConNombres {
  return {
    id: fila.id,
    cliente_id: fila.cliente_id,
    producto_id: fila.producto_id,
    titulo: fila.titulo,
    notas: fila.notas,
    fecha_hora: fila.fecha_hora,
    estado: fila.estado,
    owner_id: fila.owner_id,
    created_by: fila.created_by,
    created_at: fila.created_at,
    updated_at: fila.updated_at,
    cliente_nombre: fila.clientes?.razon_social ?? '',
    producto_nombre: fila.productos?.nombre ?? '',
  }
}

export function useCitasCapacitacion() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { error: toastError } = useToast()

  const citasProximas = useState<CitaCapacitacionConNombres[]>('citas-proximas', () => [])
  const idsCitasDescartadas = useState<Set<string>>('citas-proximas-descartadas', () => new Set())

  async function fetchCitas(): Promise<CitaCapacitacionConNombres[]> {
    const { data, error } = await supabase
      .from('citas_capacitacion')
      .select('*, clientes(razon_social), productos(nombre)')
      .order('fecha_hora', { ascending: true })

    if (error) throw error
    return (data ?? []).map(mapearFila)
  }

  async function crearCita(payload: {
    cliente_id: string
    producto_id: string
    titulo: string
    notas: string | null
    fecha_hora: string
    owner_id?: string
  }): Promise<CitaCapacitacion> {
    const { data, error } = await supabase
      .from('citas_capacitacion')
      .insert({
        ...payload,
        owner_id: payload.owner_id ?? user.value?.sub,
        created_by: user.value?.sub,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function actualizarCita(
    id: string,
    payload: Partial<Pick<CitaCapacitacion, 'titulo' | 'notas' | 'fecha_hora' | 'estado' | 'owner_id' | 'producto_id' | 'cliente_id'>>
  ): Promise<CitaCapacitacion> {
    const { data, error } = await supabase
      .from('citas_capacitacion')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // "Mis" próximas = responsable de la cita (owner_id, o created_by si no
  // tiene owner), sin depender de view_all - mismo criterio que
  // fetchMisTareasPendientes (ver gotcha #16 de CONTEXTO_PROYECTO.md).
  async function fetchMisCitasPendientes(): Promise<CitaCapacitacionConNombres[]> {
    if (!user.value) return []
    const uid = user.value.sub
    const { data, error } = await supabase
      .from('citas_capacitacion')
      .select('*, clientes(razon_social), productos(nombre)')
      .eq('estado', 'pendiente')
      .or(`owner_id.eq.${uid},and(owner_id.is.null,created_by.eq.${uid})`)
      .order('fecha_hora', { ascending: true })

    if (error) throw error
    return (data ?? []).map(mapearFila)
  }

  async function refrescarCitasProximas(): Promise<void> {
    const { perfil } = useMiPerfil()
    const valorConfigurado = perfil.value?.settings?.umbral_alertas_minutos
    const umbralMinutos = typeof valorConfigurado === 'number' ? valorConfigurado : UMBRAL_MINUTOS_DEFAULT

    const pendientes = await fetchMisCitasPendientes()
    const ahora = Date.now()
    citasProximas.value = pendientes.filter((c) => {
      if (idsCitasDescartadas.value.has(c.id)) return false
      const msRestante = new Date(c.fecha_hora).getTime() - ahora
      return msRestante <= umbralMinutos * 60_000
    })

    const idsPendientes = new Set(pendientes.map((c) => c.id))
    const idsPodados: string[] = []
    for (const id of idsCitasDescartadas.value) {
      if (!idsPendientes.has(id)) {
        idsCitasDescartadas.value.delete(id)
        idsPodados.push(id)
      }
    }
    if (idsPodados.length > 0 && user.value) {
      await supabase.from('citas_descartadas').delete().eq('user_id', user.value.sub).in('cita_id', idsPodados)
    }
  }

  async function descartarCitaProxima(id: string): Promise<void> {
    idsCitasDescartadas.value.add(id)
    citasProximas.value = citasProximas.value.filter((c) => c.id !== id)

    if (!user.value) return
    const { error } = await supabase
      .from('citas_descartadas')
      .upsert({ user_id: user.value.sub, cita_id: id }, { onConflict: 'user_id,cita_id' })

    if (error) {
      idsCitasDescartadas.value.delete(id)
      toastError('No se pudo descartar el aviso, intentá de nuevo')
    }
  }

  async function cargarDescartadasGuardadas(): Promise<void> {
    if (!user.value) return
    const { data, error } = await supabase
      .from('citas_descartadas')
      .select('cita_id')
      .eq('user_id', user.value.sub)

    if (error) return
    idsCitasDescartadas.value = new Set((data ?? []).map((d) => d.cita_id))
  }

  return {
    fetchCitas,
    crearCita,
    actualizarCita,
    citasProximas,
    refrescarCitasProximas,
    descartarCitaProxima,
    cargarDescartadasGuardadas,
  }
}
```

- [ ] **Step 2: Reiniciar el dev server (gotcha #2 — composables nuevos no los recoge el hot-reload)**

```bash
rm -rf .nuxt && npm run dev
```

Expected: arranca sin errores en consola.

- [ ] **Step 3: Verificar en la consola del navegador que el composable resuelve**

Con el dev server corriendo y sesión iniciada, abrir devtools y en cualquier página ejecutar en la consola:
```js
// no aplica un test real - se verifica en Task 10 al usarlo desde la UI
```
(Este composable no tiene UI propia todavía — se verifica end-to-end en Task 10. Este paso solo confirma que Nuxt no tira error de import al arrancar.)

- [ ] **Step 4: Commit**

```bash
git add app/composables/useCitasCapacitacion.ts
git commit -m "feat: agregar useCitasCapacitacion"
```

---

### Task 7: Badge de estado en `estadoColores.ts`

**Files:**
- Modify: `app/utils/estadoColores.ts`

**Interfaces:**
- Produces: `colorCitaCapacitacion(estado: string): EstiloEstado`

- [ ] **Step 1: Agregar la función**

Al final de `app/utils/estadoColores.ts` (después de `colorCanal`):

```ts
export function colorCitaCapacitacion(estado: string): EstiloEstado {
  const mapa: Record<string, EstiloEstado> = {
    pendiente: { label: 'Pendiente', clases: PRIMARIO_BG },
    completada: { label: 'Completada', clases: VERDE_BG },
    cancelada: { label: 'Cancelada', clases: GRIS_BG },
  }
  return mapa[estado] ?? { label: estado, clases: GRIS_BG }
}
```

- [ ] **Step 2: Verificar que el archivo sigue exportando todo correctamente**

```bash
grep -n "^export function color" app/utils/estadoColores.ts
```

Expected: 5 líneas (`colorLead`, `colorTicket`, `colorPrioridad`, `colorCanal`, `colorCitaCapacitacion`).

- [ ] **Step 3: Commit**

```bash
git add app/utils/estadoColores.ts
git commit -m "feat: agregar colorCitaCapacitacion para el badge de estado"
```

---

### Task 8: Generalizar `RecordatorioAlert` para mezclar tareas + citas

**Files:**
- Modify: `app/components/shared/RecordatorioAlert.vue`
- Modify: `app/components/shared/RecordatorioAlertContainer.vue`

**Interfaces:**
- Consumes: `useTareas()` (`tareasProximas`, `refrescarTareasProximas`, `descartarTareaProxima`, `cargarDescartadasGuardadas`), `useCitasCapacitacion()` (`citasProximas`, `refrescarCitasProximas`, `descartarCitaProxima`, `cargarDescartadasGuardadas` — Task 6).
- Produces: `RecordatorioAlert.vue` con prop `aviso: { id: string; titulo: string; fecha_vencimiento: string | null }` (antes `tarea: Tarea`) — desacoplado del tipo `Tarea`, ya no le importa el origen.

- [ ] **Step 1: Cambiar la prop de `RecordatorioAlert.vue`**

Contenido actual completo:

```vue
<script setup lang="ts">
import type { Tarea } from '~/composables/useTareas'

const props = defineProps<{ tarea: Tarea }>()
defineEmits<{ cerrar: []; click: [] }>()

const esVencida = computed(
  () => !!props.tarea.fecha_vencimiento && new Date(props.tarea.fecha_vencimiento).getTime() < Date.now()
)

function formatearHora(fechaVencimiento: string): string {
  const msDiferencia = Math.abs(new Date(fechaVencimiento).getTime() - Date.now())
  const minutos = Math.max(1, Math.round(msDiferencia / 60_000))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.round(minutos / 60)
  return `${horas} hora${horas === 1 ? '' : 's'}`
}
</script>

<template>
  <div
    class="border-2 rounded-xl shadow-xl px-5 py-4 flex items-start gap-4 text-base"
    :class="
      esVencida
        ? 'border-danger-text/40 bg-danger-bg text-danger-text'
        : 'border-warning-text/40 bg-warning-bg text-warning-text'
    "
  >
    <span class="text-2xl shrink-0">{{ esVencida ? '⚠️' : '⏰' }}</span>
    <div class="flex-1 min-w-0 cursor-pointer" @click="$emit('click')">
      <p class="font-semibold text-base truncate">{{ tarea.titulo }}</p>
      <p v-if="tarea.fecha_vencimiento" class="text-sm opacity-80 mt-0.5">
        {{ esVencida ? 'Venció hace' : 'Vence en' }} {{ formatearHora(tarea.fecha_vencimiento) }}
      </p>
    </div>
    <button class="text-lg opacity-60 hover:opacity-100 shrink-0" @click="$emit('cerrar')">✕</button>
  </div>
</template>
```

Reemplazar por:

```vue
<script setup lang="ts">
export interface AvisoRecordatorio {
  id: string
  titulo: string
  fecha_vencimiento: string | null
}

const props = defineProps<{ aviso: AvisoRecordatorio }>()
defineEmits<{ cerrar: []; click: [] }>()

const esVencida = computed(
  () => !!props.aviso.fecha_vencimiento && new Date(props.aviso.fecha_vencimiento).getTime() < Date.now()
)

function formatearHora(fechaVencimiento: string): string {
  const msDiferencia = Math.abs(new Date(fechaVencimiento).getTime() - Date.now())
  const minutos = Math.max(1, Math.round(msDiferencia / 60_000))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.round(minutos / 60)
  return `${horas} hora${horas === 1 ? '' : 's'}`
}
</script>

<template>
  <div
    class="border-2 rounded-xl shadow-xl px-5 py-4 flex items-start gap-4 text-base"
    :class="
      esVencida
        ? 'border-danger-text/40 bg-danger-bg text-danger-text'
        : 'border-warning-text/40 bg-warning-bg text-warning-text'
    "
  >
    <span class="text-2xl shrink-0">{{ esVencida ? '⚠️' : '⏰' }}</span>
    <div class="flex-1 min-w-0 cursor-pointer" @click="$emit('click')">
      <p class="font-semibold text-base truncate">{{ aviso.titulo }}</p>
      <p v-if="aviso.fecha_vencimiento" class="text-sm opacity-80 mt-0.5">
        {{ esVencida ? 'Venció hace' : 'Vence en' }} {{ formatearHora(aviso.fecha_vencimiento) }}
      </p>
    </div>
    <button class="text-lg opacity-60 hover:opacity-100 shrink-0" @click="$emit('cerrar')">✕</button>
  </div>
</template>
```

- [ ] **Step 2: Reescribir `RecordatorioAlertContainer.vue`**

Contenido completo nuevo:

```vue
<script setup lang="ts">
import type { Tarea } from '~/composables/useTareas'
import type { AvisoRecordatorio } from './RecordatorioAlert.vue'

const {
  tareasProximas,
  refrescarTareasProximas,
  descartarTareaProxima,
  cargarDescartadasGuardadas: cargarDescartesTareas,
} = useTareas()
const {
  citasProximas,
  refrescarCitasProximas,
  descartarCitaProxima,
  cargarDescartadasGuardadas: cargarDescartesCitas,
} = useCitasCapacitacion()
const router = useRouter()

let intervalo: ReturnType<typeof setInterval> | null = null

const rutaEntidad: Record<Tarea['entidad_tipo'], string> = {
  lead: '/leads',
  cliente: '/clientes',
  ticket: '/tickets',
}

interface AvisoConTipo extends AvisoRecordatorio {
  tipo: 'tarea' | 'cita'
}

const avisos = computed<AvisoConTipo[]>(() =>
  [
    ...tareasProximas.value.map((t) => ({ id: t.id, tipo: 'tarea' as const, titulo: t.titulo, fecha_vencimiento: t.fecha_vencimiento })),
    ...citasProximas.value.map((c) => ({
      id: c.id,
      tipo: 'cita' as const,
      titulo: `Capacitación: ${c.producto_nombre} — ${c.cliente_nombre}`,
      fecha_vencimiento: c.fecha_hora,
    })),
  ].sort((a, b) => new Date(a.fecha_vencimiento ?? 0).getTime() - new Date(b.fecha_vencimiento ?? 0).getTime())
)

function onClickAviso(aviso: AvisoConTipo) {
  if (aviso.tipo === 'cita') {
    router.push('/capacitaciones')
    return
  }
  const tarea = tareasProximas.value.find((t) => t.id === aviso.id)
  if (tarea) router.push(`${rutaEntidad[tarea.entidad_tipo]}/${tarea.entidad_id}`)
}

function onCerrarAviso(aviso: AvisoConTipo) {
  if (aviso.tipo === 'cita') descartarCitaProxima(aviso.id)
  else descartarTareaProxima(aviso.id)
}

onMounted(async () => {
  await Promise.all([cargarDescartesTareas(), cargarDescartesCitas()])
  refrescarTareasProximas()
  refrescarCitasProximas()
  intervalo = setInterval(() => {
    refrescarTareasProximas()
    refrescarCitasProximas()
  }, 60_000)
})

onUnmounted(() => {
  if (intervalo) clearInterval(intervalo)
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-20 right-4 z-50 space-y-3 w-96">
      <TransitionGroup name="recordatorio">
        <SharedRecordatorioAlert
          v-for="a in avisos"
          :key="a.id"
          :aviso="a"
          @cerrar="onCerrarAviso(a)"
          @click="onClickAviso(a)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.recordatorio-enter-active,
.recordatorio-leave-active {
  transition: all 0.2s ease;
}
.recordatorio-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.recordatorio-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
```

- [ ] **Step 3: Reiniciar dev server y verificar en el navegador**

```bash
rm -rf .nuxt && npm run dev
```

Con sesión iniciada y una tarea con `fecha_vencimiento` dentro de la ventana de aviso (ver Task 6 de la spec original de `RecordatorioAlert`): confirmar que el popup sigue apareciendo igual que antes (esto verifica que el refactor de prop `tarea`→`aviso` no rompió nada, todavía sin citas creadas).

Expected: sin errores de consola, popup de tarea se ve igual que antes del refactor.

- [ ] **Step 4: Commit**

```bash
git add app/components/shared/RecordatorioAlert.vue app/components/shared/RecordatorioAlertContainer.vue
git commit -m "refactor: generalizar RecordatorioAlert para mezclar tareas y citas de capacitacion"
```

---

### Task 9: Componente de formulario `CapacitacionesCitaForm.vue`

**Files:**
- Create: `app/components/capacitaciones/CitaForm.vue`

**Interfaces:**
- Consumes: `ClientesClienteBuscador` (prop `modelValue: string`, evento `update:modelValue`), `useProductos().fetchProductos()`, `useUsuarios().fetchUsuariosPorRol('capacitaciones')`.
- Produces: componente `<CapacitacionesCitaForm>` — props `modelValue?: Partial<CitaCapacitacion>`, `cargando?: boolean`; emite `submit: [payload: Record<string, unknown>]`.

- [ ] **Step 1: Escribir el componente**

```vue
<script setup lang="ts">
import type { CitaCapacitacion } from '~/composables/useCitasCapacitacion'
import type { Producto } from '~/composables/useProductos'
import type { Usuario } from '~/composables/useUsuarios'

const props = defineProps<{ modelValue?: Partial<CitaCapacitacion>; cargando?: boolean }>()
const emit = defineEmits<{ submit: [payload: Record<string, unknown>] }>()

const { fetchProductos } = useProductos()
const { fetchUsuariosPorRol } = useUsuarios()
const user = useSupabaseUser()

const productos = ref<Producto[]>([])
const responsables = ref<Usuario[]>([])

function aFechaInput(fechaIso?: string): string {
  if (!fechaIso) return ''
  const d = new Date(fechaIso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function aHoraInput(fechaIso?: string): string {
  if (!fechaIso) return ''
  const d = new Date(fechaIso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const form = reactive({
  cliente_id: props.modelValue?.cliente_id ?? '',
  producto_id: props.modelValue?.producto_id ?? '',
  titulo: props.modelValue?.titulo ?? '',
  notas: props.modelValue?.notas ?? '',
  fecha: aFechaInput(props.modelValue?.fecha_hora),
  hora: aHoraInput(props.modelValue?.fecha_hora),
  owner_id: props.modelValue?.owner_id ?? user.value?.sub ?? '',
})

const errores = reactive<Record<string, string>>({})

onMounted(async () => {
  productos.value = (await fetchProductos()).filter((p) => p.estado === 'activo')
  responsables.value = await fetchUsuariosPorRol('capacitaciones')
})

function validar(): boolean {
  errores.cliente_id = form.cliente_id ? '' : 'Debes seleccionar un cliente'
  errores.producto_id = form.producto_id ? '' : 'Debes seleccionar un producto'
  errores.titulo = form.titulo.trim() ? '' : 'El tema es obligatorio'
  errores.fecha = form.fecha ? '' : 'La fecha es obligatoria'
  errores.hora = form.hora ? '' : 'La hora es obligatoria'
  return !Object.values(errores).some(Boolean)
}

function onSubmit() {
  if (!validar()) return
  const [anio, mes, dia] = form.fecha.split('-').map(Number)
  const [horas, minutos] = form.hora.split(':').map(Number)
  const fecha_hora = new Date(anio, mes - 1, dia, horas, minutos).toISOString()

  emit('submit', {
    cliente_id: form.cliente_id,
    producto_id: form.producto_id,
    titulo: form.titulo.trim(),
    notas: form.notas.trim() || null,
    fecha_hora,
    owner_id: form.owner_id || undefined,
  })
}

const inputClase =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]'
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Cliente *</label>
      <ClientesClienteBuscador v-model="form.cliente_id" />
      <p v-if="errores.cliente_id" class="text-sm text-red-600 mt-1">{{ errores.cliente_id }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Producto *</label>
      <select v-model="form.producto_id" :class="inputClase">
        <option value="">Selecciona un producto</option>
        <option v-for="p in productos" :key="p.id" :value="p.id">{{ p.nombre }}</option>
      </select>
      <p v-if="errores.producto_id" class="text-sm text-red-600 mt-1">{{ errores.producto_id }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Tema *</label>
      <input v-model="form.titulo" type="text" :class="inputClase" />
      <p v-if="errores.titulo" class="text-sm text-red-600 mt-1">{{ errores.titulo }}</p>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Fecha *</label>
        <input v-model="form.fecha" type="date" :class="inputClase" />
        <p v-if="errores.fecha" class="text-sm text-red-600 mt-1">{{ errores.fecha }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Hora *</label>
        <input v-model="form.hora" type="time" :class="inputClase" />
        <p v-if="errores.hora" class="text-sm text-red-600 mt-1">{{ errores.hora }}</p>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Responsable</label>
      <select v-model="form.owner_id" :class="inputClase">
        <option v-for="r in responsables" :key="r.id" :value="r.id">{{ r.full_name || r.email }}</option>
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Notas</label>
      <textarea v-model="form.notas" rows="3" :class="inputClase"></textarea>
    </div>

    <button
      type="submit"
      :disabled="cargando"
      class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {{ cargando ? 'Guardando...' : 'Guardar capacitación' }}
    </button>
  </form>
</template>
```

- [ ] **Step 2: Reiniciar dev server**

```bash
rm -rf .nuxt && npm run dev
```

Expected: arranca sin errores (el componente todavía no se usa en ninguna página — se verifica end-to-end en Task 10).

- [ ] **Step 3: Commit**

```bash
git add app/components/capacitaciones/CitaForm.vue
git commit -m "feat: agregar formulario de cita de capacitacion"
```

---

### Task 10: Página `/capacitaciones` + entrada de navegación

**Files:**
- Create: `app/pages/capacitaciones/index.vue`
- Modify: `app/layouts/default.vue`

**Interfaces:**
- Consumes: `useCitasCapacitacion()` (Task 6), `CapacitacionesCitaForm` (Task 9), `colorCitaCapacitacion` (Task 7), `SharedModal`, `SharedPageHeader`, `SharedConfirmDialog` (ya existe, reutilizado para confirmar cancelación).

- [ ] **Step 1: Escribir la página**

```vue
<!-- app/pages/capacitaciones/index.vue -->
<script setup lang="ts">
import type { CitaCapacitacionConNombres } from '~/composables/useCitasCapacitacion'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'capacitaciones', actions: ['view', 'view_all'] },
})

const { fetchCitas, crearCita, actualizarCita } = useCitasCapacitacion()
const { success, error } = useToast()
const { can } = usePermissions()

const citas = ref<CitaCapacitacionConNombres[]>([])
const cargando = ref(true)
const guardando = ref(false)
const modalAbierto = ref(false)
const citaEditando = ref<CitaCapacitacionConNombres | null>(null)
const filtroDesde = ref('')
const filtroHasta = ref('')

async function cargar() {
  cargando.value = true
  citas.value = await fetchCitas()
  cargando.value = false
}

onMounted(cargar)

const citasFiltradas = computed(() => {
  return citas.value.filter((c) => {
    const t = new Date(c.fecha_hora).getTime()
    if (filtroDesde.value && t < new Date(filtroDesde.value).getTime()) return false
    if (filtroHasta.value) {
      const finDia = new Date(filtroHasta.value)
      finDia.setHours(23, 59, 59, 999)
      if (t > finDia.getTime()) return false
    }
    return true
  })
})

function filtrarHoy() {
  const hoy = new Date().toISOString().slice(0, 10)
  filtroDesde.value = hoy
  filtroHasta.value = hoy
}

function filtrarEstaSemana() {
  const ahora = new Date()
  const inicio = new Date(ahora)
  inicio.setDate(ahora.getDate() - ahora.getDay())
  const fin = new Date(inicio)
  fin.setDate(inicio.getDate() + 6)
  filtroDesde.value = inicio.toISOString().slice(0, 10)
  filtroHasta.value = fin.toISOString().slice(0, 10)
}

function abrirNueva() {
  citaEditando.value = null
  modalAbierto.value = true
}

function abrirEditar(c: CitaCapacitacionConNombres) {
  citaEditando.value = c
  modalAbierto.value = true
}

async function onSubmit(payload: Record<string, unknown>) {
  guardando.value = true
  try {
    if (citaEditando.value) {
      await actualizarCita(citaEditando.value.id, payload)
      success('Capacitación actualizada')
    } else {
      await crearCita(payload as any)
      success('Capacitación agendada')
    }
    modalAbierto.value = false
    await cargar()
  } catch (e) {
    error('No se pudo guardar la capacitación. Intenta de nuevo.')
  } finally {
    guardando.value = false
  }
}

async function cambiarEstado(c: CitaCapacitacionConNombres, estado: 'completada' | 'cancelada') {
  try {
    await actualizarCita(c.id, { estado })
    await cargar()
    success(estado === 'completada' ? 'Marcada como completada' : 'Capacitación cancelada')
  } catch (e) {
    error('No se pudo actualizar el estado')
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Capacitaciones">
      <template #accion>
        <button
          v-if="can('capacitaciones', 'create')"
          class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          @click="abrirNueva"
        >
          + Nueva capacitación
        </button>
      </template>
    </SharedPageHeader>

    <div class="flex flex-wrap gap-2 mb-4">
      <input v-model="filtroDesde" type="date" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <input v-model="filtroHasta" type="date" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <button class="text-sm text-[#1075B5] hover:underline" @click="filtrarHoy">Hoy</button>
      <button class="text-sm text-[#1075B5] hover:underline" @click="filtrarEstaSemana">Esta semana</button>
    </div>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <p v-else-if="!citasFiltradas.length" class="text-gray-400">Sin capacitaciones para el rango elegido.</p>

    <ul v-else class="space-y-2">
      <li
        v-for="c in citasFiltradas"
        :key="c.id"
        class="border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-3"
      >
        <div class="min-w-0">
          <p class="text-sm font-medium text-gray-800">{{ c.cliente_nombre }} — {{ c.producto_nombre }}</p>
          <p class="text-xs text-gray-400">{{ formatearFecha(c.fecha_hora) }} · {{ c.titulo }}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <SharedBadge :label="colorCitaCapacitacion(c.estado).label" :clases="colorCitaCapacitacion(c.estado).clases" />
          <button class="text-xs text-[#1075B5] hover:underline" @click="abrirEditar(c)">Editar</button>
          <button
            v-if="c.estado === 'pendiente'"
            class="text-xs text-green-600 hover:underline"
            @click="cambiarEstado(c, 'completada')"
          >
            Completar
          </button>
          <button
            v-if="c.estado === 'pendiente'"
            class="text-xs text-red-600 hover:underline"
            @click="cambiarEstado(c, 'cancelada')"
          >
            Cancelar
          </button>
        </div>
      </li>
    </ul>

    <SharedModal
      :open="modalAbierto"
      :titulo="citaEditando ? 'Editar capacitación' : 'Nueva capacitación'"
      @cerrar="modalAbierto = false"
    >
      <CapacitacionesCitaForm :model-value="citaEditando ?? undefined" :cargando="guardando" @submit="onSubmit" />
    </SharedModal>
  </div>
</template>
```

- [ ] **Step 2: Agregar la entrada de navegación**

En `app/layouts/default.vue`, dentro de `<nav>`, agregar un ítem junto a los de "CRM" (después del bloque de `navCrm`, antes de "Administración"):

```html
<div v-if="can('capacitaciones', 'view') || can('capacitaciones', 'view_all')">
  <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Capacitaciones</p>
  <SharedNavLink to="/capacitaciones" :activo="esActivo('/capacitaciones')">
    Agenda
  </SharedNavLink>
</div>
```

- [ ] **Step 3: Reiniciar dev server y probar en el navegador**

```bash
rm -rf .nuxt && npm run dev
```

Con la cuenta `informatica@integrakin.cl` (rol `capacitaciones`, asignado en Task 1):
1. Login, confirmar que aparece "Capacitaciones" en el nav.
2. Entrar a `/capacitaciones`, click "+ Nueva capacitación".
3. Completar cliente (buscar uno real), producto, tema, fecha (mañana), hora, guardar.
4. Confirmar que aparece en la lista con badge "Pendiente".
5. Click "Completar" — el badge cambia a "Completada" y desaparecen los botones Completar/Cancelar.
6. Crear otra cita con fecha/hora dentro de los próximos 30 min — confirmar que aparece en el popup `RecordatorioAlert` (esquina superior derecha) en cualquier página, junto con tareas si las hay.
7. Cerrar (✕) ese aviso — confirmar que no reaparece al recargar la página.

Expected: los 7 pasos funcionan sin errores en consola.

- [ ] **Step 4: Commit**

```bash
git add app/pages/capacitaciones/index.vue app/layouts/default.vue
git commit -m "feat: agregar pagina /capacitaciones con lista, filtros y alta/edicion"
```

---

### Task 11: Actualizar `CONTEXTO_PROYECTO.md`

**Files:**
- Modify: `CONTEXTO_PROYECTO.md`

**Interfaces:** ninguna — solo documentación.

- [ ] **Step 1: Agregar la migración nueva a la lista**

En la sección `### Migraciones SQL`, agregar al final del bloque de código:

```
20260714050000_citas_capacitacion.sql
20260714060000_citas_descartadas.sql
20260714070000_notificacion_capacitacion_asignada.sql
20260714080000_notificacion_citas_vencidas.sql
```

- [ ] **Step 2: Agregar la página, composable y componentes nuevos**

En `### Páginas`, agregar `capacitaciones/index.vue — agenda de capacitaciones (lista + filtro de fecha)`.
En `### Composables`, agregar `useCitasCapacitacion` a la lista alfabética.
En `### Componentes`, agregar `capacitaciones/CitaForm.vue` en su propia línea de módulo.

- [ ] **Step 3: Agregar entrada al Roadmap**

Al final de la sección `## Roadmap — estado actual`, agregar:

```
28. ✅ **Agenda de capacitaciones** — módulo nuevo completo para el rol
    `capacitaciones` (antes placeholder sin permisos). Tabla
    `citas_capacitacion` (cliente + producto obligatorios, sin
    recurrencia), notificación al asignar responsable + cron de
    vencidas (mismo patrón que tareas), popup `RecordatorioAlert`
    generalizado para mostrar tareas y citas juntas. Página
    `/capacitaciones` con lista y filtro de fecha (sin calendario
    visual — ver spec `2026-07-14-agenda-capacitaciones-design.md`).
```

Actualizar la fecha de "Última actualización" al tope del documento a la fecha en que se ejecute esta tarea.

- [ ] **Step 4: Commit**

```bash
git add CONTEXTO_PROYECTO.md
git commit -m "docs: actualizar contexto con la agenda de capacitaciones"
```

---

## Self-Review Notes

- **Cobertura de la spec:** modelo de datos (Task 1), `citas_descartadas` (Task 2), notificación al asignar (Task 3), cron de vencidas (Task 4), iconos de campana (Task 5), composable (Task 6), badge de estado (Task 7), popup combinado (Task 8), formulario (Task 9), página + nav (Task 10), doc (Task 11). Las "Alternativas descartadas" y "Fuera de alcance" de la spec no generan tareas a propósito (calendario visual, tab en `ClienteSplitView`, recurrencia, reasignar responsable post-creación — ninguno se implementa).
- **Placeholders:** ninguno — cada paso tiene código completo o comando exacto.
- **Consistencia de tipos:** `CitaCapacitacion`/`CitaCapacitacionConNombres` (Task 6) se usan sin cambios en Task 9 y Task 10; `AvisoRecordatorio` (Task 8) coincide entre `RecordatorioAlert.vue` y `RecordatorioAlertContainer.vue`; `colorCitaCapacitacion` (Task 7) se usa con el mismo nombre en Task 10.
