# Tickets de Post-venta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un sistema de tickets propio para el equipo de post-venta (reparación/garantía de equipos), separado del `tickets` que usa servicio_técnico, con seguimiento por bitácora y aviso automático de vencimiento.

**Architecture:** Tabla propia `tickets_post_venta` (sin `owner_id` — todo el equipo ve/edita todo por igual, a diferencia de `tareas`/`citas_capacitacion`), tabla hija `tickets_post_venta_seguimientos` (bitácora, mismo patrón que `cliente_interacciones`). Reutiliza la infraestructura de `notificaciones` + `pg_cron` para el aviso de vencido, pero a diferencia de otros módulos el destinatario es **todo el rol `post_venta`** (broadcast), no un responsable individual. Página nueva `/post-venta` con vista Kanban (mismo patrón `TicketBoard.vue`, 7 columnas) + página de detalle `/post-venta/[id]` con bitácora.

**Tech Stack:** Nuxt 4 / Vue 3 / Supabase (Postgres + RLS + `pg_cron`) + `vuedraggable` (ya instalado) — mismo stack que el resto del repo, sin librerías nuevas.

## Global Constraints

- Spec completo: `docs/superpowers/specs/2026-07-14-tickets-post-venta-design.md`.
- Sin `owner_id` — decisión explícita del usuario: todo el equipo de post_venta ve y edita todos los tickets por igual. Un solo permiso `tickets_post_venta.view` alcanza (no hay `view_all` separado).
- `cliente_id` es **nullable** — caso "cliente no registrado" usa 4 columnas de texto libre en la misma fila (`cliente_nombre_libre`/`cliente_rut_libre`/`cliente_celular_libre`/`cliente_ciudad_libre`), sin tabla aparte.
- Fechas (`fecha_ingreso`/`fecha_tope`/`fecha_despacho`) son `date`, no `timestamptz` — no se pidió hora.
- Sin policy de `delete` en ninguna tabla nueva (mismo criterio que `tareas`/`citas_capacitacion`).
- Notificación de vencido va a **todos los usuarios con rol `post_venta`** (broadcast por rol, no por `owner_id` — no existe).
- **No hay suite de tests automatizada en este proyecto** (sin `vitest`/`jest`, sin archivos `*.test.*`/`*.spec.*`). Verificación manual: SQL directo para migraciones (`mcp__supabase__execute_sql`), navegador para UI, con `rm -rf .nuxt && npm run dev` tras crear composables/componentes nuevos (gotcha #2 de `CONTEXTO_PROYECTO.md`).
- Cuenta de prueba ya lista: `n.quevedo@integrakin.cl` ya tiene el rol `post_venta` asignado (confirmado por SQL) — no hace falta asignarlo en este plan, a diferencia del plan de capacitaciones.

---

### Task 1: Migración — tabla `tickets_post_venta` + RLS + permisos

**Files:**
- Create: `supabase/migrations/20260714200000_tickets_post_venta.sql`

**Interfaces:**
- Produces: tabla `tickets_post_venta(id, n_guia, cliente_id, cliente_nombre_libre, cliente_rut_libre, cliente_celular_libre, cliente_ciudad_libre, producto_id, descripcion_falla, estado, fecha_ingreso, fecha_tope, fecha_despacho, observaciones, notificada_vencida, created_by, created_at, updated_at)`, permisos `tickets_post_venta.view`/`.create`/`.edit` asignados a `post_venta` y `dueña`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260714200000_tickets_post_venta.sql
--
-- Sistema de tickets de post-venta (reparación/garantía de equipos),
-- separado del `tickets` que usa servicio_técnico. Ver spec
-- 2026-07-14-tickets-post-venta-design.md.
--
-- Sin owner_id: todo el equipo de post_venta ve/edita todo por igual
-- (decisión explícita), así que un solo permiso `view` alcanza para ver
-- todo (no hay `view_all` separado como en el resto de módulos).

create table tickets_post_venta (
  id uuid primary key default gen_random_uuid(),
  n_guia text not null,
  cliente_id uuid references clientes(id),
  cliente_nombre_libre text,
  cliente_rut_libre text,
  cliente_celular_libre text,
  cliente_ciudad_libre text,
  producto_id uuid not null references productos(id),
  descripcion_falla text,
  estado text check (estado in (
    'pendiente_ingreso','ingreso_equipo','probando',
    'espera_repuesto','listo_despacho','despachado','desconocido'
  )) not null default 'pendiente_ingreso',
  fecha_ingreso date not null default current_date,
  fecha_tope date,
  fecha_despacho date,
  observaciones text,
  notificada_vencida boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_post_venta_cliente_check check (
    cliente_id is not null or cliente_nombre_libre is not null
  )
);

create index idx_tickets_post_venta_estado on tickets_post_venta(estado);
create index idx_tickets_post_venta_cliente on tickets_post_venta(cliente_id);

alter table tickets_post_venta enable row level security;

create policy select_tickets_post_venta on tickets_post_venta
for select using (has_permission(auth.uid(), 'tickets_post_venta', 'view'));

create policy insert_tickets_post_venta on tickets_post_venta
for insert with check (
  created_by = auth.uid()
  and has_permission(auth.uid(), 'tickets_post_venta', 'create')
);

create policy update_tickets_post_venta on tickets_post_venta
for update using (has_permission(auth.uid(), 'tickets_post_venta', 'edit'));

insert into permissions (resource, action) values
  ('tickets_post_venta', 'view'), ('tickets_post_venta', 'create'), ('tickets_post_venta', 'edit')
on conflict (resource, action) do nothing;

do $$
declare
  r_id uuid;
  p_id uuid;
  matriz jsonb := '{
    "dueña":      ["tickets_post_venta.view","tickets_post_venta.create","tickets_post_venta.edit"],
    "post_venta": ["tickets_post_venta.view","tickets_post_venta.create","tickets_post_venta.edit"]
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

Aplicar con `mcp__supabase__apply_migration` (`name: "tickets_post_venta"`, `query`: el contenido de arriba).

Expected: `{"success": true}`.

- [ ] **Step 3: Verificar permisos**

```sql
select r.name, p.resource, p.action
from role_permissions rp
join roles r on r.id = rp.role_id
join permissions p on p.id = rp.permission_id
where p.resource = 'tickets_post_venta'
order by r.name, p.action;
```

Expected: 6 filas — `dueña` con `create`/`edit`/`view`, `post_venta` con `create`/`edit`/`view`.

- [ ] **Step 4: Verificar el constraint de cliente**

```sql
-- debe fallar (violación de tickets_post_venta_cliente_check)
insert into tickets_post_venta (n_guia, producto_id)
select 'TEST-000', id from productos limit 1;
```

Expected: error `new row for relation "tickets_post_venta" violates check constraint "tickets_post_venta_cliente_check"`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260714200000_tickets_post_venta.sql
git commit -m "feat: agregar tabla tickets_post_venta con RLS y permisos"
```

---

### Task 2: Migración — tabla `tickets_post_venta_seguimientos`

**Files:**
- Create: `supabase/migrations/20260714210000_tickets_post_venta_seguimientos.sql`

**Interfaces:**
- Consumes: tabla `tickets_post_venta(id)` (Task 1).
- Produces: tabla `tickets_post_venta_seguimientos(id, ticket_id, fecha, comentario, created_by, created_at)` con RLS (select/insert, sin update/delete — bitácora de solo agregar).

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260714210000_tickets_post_venta_seguimientos.sql
--
-- Bitácora de seguimiento de un ticket de post-venta — mismo patrón que
-- cliente_interacciones (solo insert + select, sin update/delete).

create table tickets_post_venta_seguimientos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets_post_venta(id) on delete cascade,
  fecha date not null default current_date,
  comentario text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_tpv_seguimientos_ticket on tickets_post_venta_seguimientos(ticket_id);

alter table tickets_post_venta_seguimientos enable row level security;

create policy select_tpv_seguimientos on tickets_post_venta_seguimientos
for select using (has_permission(auth.uid(), 'tickets_post_venta', 'view'));

create policy insert_tpv_seguimientos on tickets_post_venta_seguimientos
for insert with check (
  created_by = auth.uid()
  and has_permission(auth.uid(), 'tickets_post_venta', 'edit')
);
```

- [ ] **Step 2: Aplicar la migración**

`mcp__supabase__apply_migration` (`name: "tickets_post_venta_seguimientos"`).

Expected: `{"success": true}`.

- [ ] **Step 3: Verificar la tabla existe**

```sql
select table_name from information_schema.tables where table_name = 'tickets_post_venta_seguimientos';
```

Expected: 1 fila.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260714210000_tickets_post_venta_seguimientos.sql
git commit -m "feat: agregar bitacora de seguimientos para tickets de post venta"
```

---

### Task 3: Migración — notificación de vencido (broadcast a `post_venta`) + cron

**Files:**
- Create: `supabase/migrations/20260714220000_notificacion_tickets_post_venta_vencidos.sql`

**Interfaces:**
- Consumes: `tickets_post_venta` (Task 1), `notificaciones` (existente), `profile_roles`/`roles` (existentes).
- Produces: función `fn_notificar_tickets_post_venta_vencidos()`, cron job `notificar-tickets-post-venta-vencidos` (cada hora), trigger `trg_resetear_notificada_vencida_tpv` que resetea `notificada_vencida` al cambiar `fecha_tope` o al revertir `estado` desde `despachado`. Agrega `tipo='ticket_post_venta_vencido'` y `entidad_tipo='ticket_post_venta'` a los checks de `notificaciones`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260714220000_notificacion_tickets_post_venta_vencidos.sql
--
-- "Vencer" no es un evento de escritura, se revisa por cron (mismo patrón
-- que fn_notificar_tareas_vencidas / fn_notificar_citas_vencidas).
--
-- A diferencia de esos dos, acá no hay owner_id individual (decisión
-- explícita del usuario: todo el equipo post_venta ve/edita todo por
-- igual), así que el destinatario es un broadcast a TODOS los profiles
-- con rol 'post_venta' (no a dueña, aunque dueña también tenga acceso a
-- la vista) - un ticket vencido genera una fila de notificación por cada
-- integrante del equipo.

alter table notificaciones drop constraint notificaciones_tipo_check;
alter table notificaciones add constraint notificaciones_tipo_check
  check (tipo in (
    'lead_asignado','ticket_asignado','tarea_asignada','tarea_vencida',
    'capacitacion_asignada','capacitacion_vencida',
    'ticket_post_venta_vencido'
  ));

alter table notificaciones drop constraint notificaciones_entidad_tipo_check;
alter table notificaciones add constraint notificaciones_entidad_tipo_check
  check (entidad_tipo in ('lead','cliente','ticket','tarea','ticket_post_venta'));

create or replace function fn_notificar_tickets_post_venta_vencidos()
returns void
language plpgsql
security definer
as $$
begin
  with vencidos as (
    update tickets_post_venta
    set notificada_vencida = true
    where fecha_tope < current_date
      and estado <> 'despachado'
      and not notificada_vencida
    returning id, n_guia
  ),
  destinatarios as (
    select pr.profile_id
    from profile_roles pr
    join roles r on r.id = pr.role_id
    where r.name = 'post_venta'
  )
  insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
  select d.profile_id, 'ticket_post_venta_vencido', 'Ticket post-venta vencido',
         'Guía ' || v.n_guia || ' pasó la fecha tope', 'ticket_post_venta', v.id
  from vencidos v cross join destinatarios d;
end;
$$;

select cron.schedule(
  'notificar-tickets-post-venta-vencidos',
  '0 * * * *',
  $$select fn_notificar_tickets_post_venta_vencidos()$$
);

create or replace function fn_resetear_notificada_vencida_tpv()
returns trigger
language plpgsql
as $$
begin
  if old.notificada_vencida
     and (new.fecha_tope is distinct from old.fecha_tope
          or (old.estado = 'despachado' and new.estado <> 'despachado')) then
    new.notificada_vencida := false;
  end if;
  return new;
end;
$$;

create trigger trg_resetear_notificada_vencida_tpv before update on tickets_post_venta
  for each row execute function fn_resetear_notificada_vencida_tpv();
```

- [ ] **Step 2: Aplicar la migración**

`mcp__supabase__apply_migration` (`name: "notificacion_tickets_post_venta_vencidos"`).

Expected: `{"success": true}`.

- [ ] **Step 3: Verificar el cron job existe**

```sql
select jobname, schedule from cron.job where jobname = 'notificar-tickets-post-venta-vencidos';
```

Expected: 1 fila, `schedule = '0 * * * *'`.

- [ ] **Step 4: Probar la función manualmente (broadcast a todo `post_venta`)**

```sql
insert into tickets_post_venta (n_guia, producto_id, cliente_id, fecha_tope, estado)
select 'TEST-VENCIDO', p.id, c.id, current_date - 2, 'probando'
from productos p, clientes c limit 1
returning id;

select fn_notificar_tickets_post_venta_vencidos();

select count(*) from notificaciones where tipo = 'ticket_post_venta_vencido';
```

Expected: la última consulta devuelve tantas filas como usuarios tengan el rol `post_venta` (al menos 1, `n.quevedo@integrakin.cl`). Limpiar después:
```sql
delete from notificaciones where tipo = 'ticket_post_venta_vencido';
delete from tickets_post_venta where n_guia = 'TEST-VENCIDO';
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260714220000_notificacion_tickets_post_venta_vencidos.sql
git commit -m "feat: agregar cron de tickets de post venta vencidos"
```

---

### Task 4: Extender notificaciones (tipo + ícono + ruta)

**Files:**
- Modify: `app/composables/useNotificaciones.ts`
- Modify: `app/components/shared/NotificationBell.vue`

**Interfaces:**
- Consumes: nada nuevo (extiende un union type existente).
- Produces: `Notificacion['tipo']` acepta `'ticket_post_venta_vencido'`, `Notificacion['entidad_tipo']` acepta `'ticket_post_venta'`.

- [ ] **Step 1: Extender los tipos en el composable**

En `app/composables/useNotificaciones.ts`, la interfaz actual (líneas 2-13) es:

```ts
export interface Notificacion {
  id: string
  user_id: string
  tipo: 'lead_asignado' | 'ticket_asignado' | 'tarea_asignada' | 'tarea_vencida'
      | 'capacitacion_asignada' | 'capacitacion_vencida'
  titulo: string
  mensaje: string | null
  entidad_tipo: 'lead' | 'cliente' | 'ticket' | 'tarea'
  entidad_id: string
  leida: boolean
  created_at: string
}
```

Reemplazar las líneas de `tipo`/`entidad_tipo` por:

```ts
  tipo: 'lead_asignado' | 'ticket_asignado' | 'tarea_asignada' | 'tarea_vencida'
      | 'capacitacion_asignada' | 'capacitacion_vencida' | 'ticket_post_venta_vencido'
  titulo: string
  mensaje: string | null
  entidad_tipo: 'lead' | 'cliente' | 'ticket' | 'tarea' | 'ticket_post_venta'
```

- [ ] **Step 2: Agregar el ícono y la ruta en `NotificationBell.vue`**

La constante `etiquetaTipo` actual (líneas 17-24):

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

Reemplazar por:

```ts
const etiquetaTipo: Record<Notificacion['tipo'], string> = {
  lead_asignado: '🧲',
  ticket_asignado: '🎫',
  tarea_asignada: '✅',
  tarea_vencida: '⏰',
  capacitacion_asignada: '🎓',
  capacitacion_vencida: '⏰',
  ticket_post_venta_vencido: '🛠️',
}
```

La constante `rutaEntidad` actual (líneas 26-31):

```ts
const rutaEntidad: Record<Notificacion['entidad_tipo'], string> = {
  lead: '/leads',
  cliente: '/clientes',
  ticket: '/tickets',
  tarea: '', // las tareas no tienen página propia, se resuelve por su entidad relacionada si hace falta
}
```

Reemplazar por:

```ts
const rutaEntidad: Record<Notificacion['entidad_tipo'], string> = {
  lead: '/leads',
  cliente: '/clientes',
  ticket: '/tickets',
  tarea: '', // las tareas no tienen página propia, se resuelve por su entidad relacionada si hace falta
  ticket_post_venta: '/post-venta',
}
```

`onClickNotificacion` (líneas 60-72) ya resuelve `rutaEntidad[n.entidad_tipo]` con `` `${base}/${n.entidad_id}` `` para cualquier tipo que no sea `capacitacion_*` — como `ticket_post_venta` sí tiene página de detalle propia (`/post-venta/[id]`, Task 11), no hace falta el `if` especial que tienen las capacitaciones: el flujo genérico ya navega a `` `/post-venta/${entidad_id}` ``. No tocar esa función.

- [ ] **Step 3: Verificar que no queda ningún `Record` incompleto**

```bash
grep -rn "Record<Notificacion\['tipo'\]\|Record<Notificacion\['entidad_tipo'\]" app/
```

Expected: una línea de `etiquetaTipo` y una de `rutaEntidad`, ambas en `NotificationBell.vue` (TypeScript fallaría el build si faltara una clave del union en esos `Record`, así que si el proyecto arranca sin errores de tipo, están completos).

- [ ] **Step 4: Commit**

```bash
git add app/composables/useNotificaciones.ts app/components/shared/NotificationBell.vue
git commit -m "feat: soportar notificaciones de tickets post venta vencidos en la campanita"
```

---

### Task 5: Composable `useTicketsPostVenta.ts`

**Files:**
- Create: `app/composables/useTicketsPostVenta.ts`

**Interfaces:**
- Consumes: `useSupabaseClient()`, `useSupabaseUser()`.
- Produces:
  - `type EstadoTicketPostVenta = 'pendiente_ingreso' | 'ingreso_equipo' | 'probando' | 'espera_repuesto' | 'listo_despacho' | 'despachado' | 'desconocido'`
  - `interface TicketPostVenta { id, n_guia, cliente_id: string|null, cliente_nombre_libre: string|null, cliente_rut_libre: string|null, cliente_celular_libre: string|null, cliente_ciudad_libre: string|null, producto_id, descripcion_falla: string|null, estado: EstadoTicketPostVenta, fecha_ingreso, fecha_tope: string|null, fecha_despacho: string|null, observaciones: string|null, notificada_vencida, created_by, created_at, updated_at }`
  - `interface TicketPostVentaConNombres extends TicketPostVenta { cliente_nombre: string; producto_nombre: string }`
  - `interface TicketPostVentaSeguimiento { id, ticket_id, fecha, comentario, created_by: string|null, created_at }`
  - `fetchTickets(): Promise<TicketPostVentaConNombres[]>`
  - `getTicket(id: string): Promise<TicketPostVentaConNombres>`
  - `crearTicket(payload): Promise<TicketPostVenta>`
  - `actualizarTicket(id, payload: Partial<Pick<TicketPostVenta,'estado'|'fecha_despacho'|'fecha_tope'|'descripcion_falla'|'observaciones'>>): Promise<TicketPostVenta>`
  - `fetchSeguimientos(ticketId): Promise<TicketPostVentaSeguimiento[]>`
  - `agregarSeguimiento(ticketId, fecha, comentario): Promise<TicketPostVentaSeguimiento>`

- [ ] **Step 1: Escribir el composable**

```ts
// composables/useTicketsPostVenta.ts

export type EstadoTicketPostVenta =
  | 'pendiente_ingreso' | 'ingreso_equipo' | 'probando'
  | 'espera_repuesto' | 'listo_despacho' | 'despachado' | 'desconocido'

export interface TicketPostVenta {
  id: string
  n_guia: string
  cliente_id: string | null
  cliente_nombre_libre: string | null
  cliente_rut_libre: string | null
  cliente_celular_libre: string | null
  cliente_ciudad_libre: string | null
  producto_id: string
  descripcion_falla: string | null
  estado: EstadoTicketPostVenta
  fecha_ingreso: string
  fecha_tope: string | null
  fecha_despacho: string | null
  observaciones: string | null
  notificada_vencida: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TicketPostVentaConNombres extends TicketPostVenta {
  cliente_nombre: string
  producto_nombre: string
}

export interface TicketPostVentaSeguimiento {
  id: string
  ticket_id: string
  fecha: string
  comentario: string
  created_by: string | null
  created_at: string
}

function mapearFila(fila: any): TicketPostVentaConNombres {
  return {
    id: fila.id,
    n_guia: fila.n_guia,
    cliente_id: fila.cliente_id,
    cliente_nombre_libre: fila.cliente_nombre_libre,
    cliente_rut_libre: fila.cliente_rut_libre,
    cliente_celular_libre: fila.cliente_celular_libre,
    cliente_ciudad_libre: fila.cliente_ciudad_libre,
    producto_id: fila.producto_id,
    descripcion_falla: fila.descripcion_falla,
    estado: fila.estado,
    fecha_ingreso: fila.fecha_ingreso,
    fecha_tope: fila.fecha_tope,
    fecha_despacho: fila.fecha_despacho,
    observaciones: fila.observaciones,
    notificada_vencida: fila.notificada_vencida,
    created_by: fila.created_by,
    created_at: fila.created_at,
    updated_at: fila.updated_at,
    cliente_nombre: fila.clientes?.razon_social ?? fila.cliente_nombre_libre ?? 'Desconocido',
    producto_nombre: fila.productos?.nombre ?? '',
  }
}

export function useTicketsPostVenta() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  async function fetchTickets(): Promise<TicketPostVentaConNombres[]> {
    const { data, error } = await supabase
      .from('tickets_post_venta')
      .select('*, clientes(razon_social), productos(nombre)')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(mapearFila)
  }

  async function getTicket(id: string): Promise<TicketPostVentaConNombres> {
    const { data, error } = await supabase
      .from('tickets_post_venta')
      .select('*, clientes(razon_social), productos(nombre)')
      .eq('id', id)
      .single()

    if (error) throw error
    return mapearFila(data)
  }

  async function crearTicket(payload: {
    n_guia: string
    cliente_id?: string | null
    cliente_nombre_libre?: string | null
    cliente_rut_libre?: string | null
    cliente_celular_libre?: string | null
    cliente_ciudad_libre?: string | null
    producto_id: string
    descripcion_falla: string | null
    fecha_ingreso: string
    fecha_tope: string | null
    observaciones: string | null
  }): Promise<TicketPostVenta> {
    const { data, error } = await supabase
      .from('tickets_post_venta')
      .insert({ ...payload, created_by: user.value?.sub })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function actualizarTicket(
    id: string,
    payload: Partial<Pick<TicketPostVenta, 'estado' | 'fecha_despacho' | 'fecha_tope' | 'descripcion_falla' | 'observaciones'>>
  ): Promise<TicketPostVenta> {
    const { data, error } = await supabase
      .from('tickets_post_venta')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function fetchSeguimientos(ticketId: string): Promise<TicketPostVentaSeguimiento[]> {
    const { data, error } = await supabase
      .from('tickets_post_venta_seguimientos')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  async function agregarSeguimiento(ticketId: string, fecha: string, comentario: string): Promise<TicketPostVentaSeguimiento> {
    const { data, error } = await supabase
      .from('tickets_post_venta_seguimientos')
      .insert({ ticket_id: ticketId, fecha, comentario, created_by: user.value?.sub })
      .select()
      .single()

    if (error) throw error
    return data
  }

  return { fetchTickets, getTicket, crearTicket, actualizarTicket, fetchSeguimientos, agregarSeguimiento }
}
```

- [ ] **Step 2: Reiniciar el dev server (gotcha #2 — composables nuevos no los recoge el hot-reload)**

```bash
rm -rf .nuxt && npm run dev
```

Expected: arranca sin errores en consola.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useTicketsPostVenta.ts
git commit -m "feat: agregar useTicketsPostVenta"
```

---

### Task 6: Badge de estado en `estadoColores.ts`

**Files:**
- Modify: `app/utils/estadoColores.ts`

**Interfaces:**
- Produces: `colorTicketPostVenta(estado: string): EstiloEstado`

- [ ] **Step 1: Agregar la función**

Al final de `app/utils/estadoColores.ts` (después de `colorCitaCapacitacion`):

```ts
export function colorTicketPostVenta(estado: string): EstiloEstado {
  const mapa: Record<string, EstiloEstado> = {
    pendiente_ingreso: { label: 'Pendiente de ingreso', clases: GRIS_BG },
    ingreso_equipo: { label: 'Ingreso de equipo', clases: PRIMARIO_BG },
    probando: { label: 'Probando', clases: MORADO_BG },
    espera_repuesto: { label: 'Espera de repuesto', clases: AMBAR_BG },
    listo_despacho: { label: 'Listo para despacho', clases: VERDE_BG },
    despachado: { label: 'Despachado', clases: GRIS_BG },
    desconocido: { label: 'Desconocido', clases: ROJO_BG },
  }
  return mapa[estado] ?? { label: estado, clases: GRIS_BG }
}
```

- [ ] **Step 2: Verificar que el archivo sigue exportando todo correctamente**

```bash
grep -n "^export function color" app/utils/estadoColores.ts
```

Expected: 6 líneas (`colorLead`, `colorTicket`, `colorPrioridad`, `colorCanal`, `colorCitaCapacitacion`, `colorTicketPostVenta`).

- [ ] **Step 3: Commit**

```bash
git add app/utils/estadoColores.ts
git commit -m "feat: agregar colorTicketPostVenta para el badge de estado"
```

---

### Task 7: Componente de formulario `PostVentaTicketForm.vue`

**Files:**
- Create: `app/components/post-venta/TicketForm.vue`

**Interfaces:**
- Consumes: `ClientesClienteBuscador` (prop `modelValue: string`, evento `update:modelValue`), `useProductos().fetchProductos()`.
- Produces: componente `<PostVentaTicketForm>` — sin props (solo alta, no edita un ticket existente); emite `submit: [payload: Record<string, unknown>]`.

- [ ] **Step 1: Escribir el componente**

```vue
<!-- app/components/post-venta/TicketForm.vue -->
<script setup lang="ts">
import type { Producto } from '~/composables/useProductos'

const props = defineProps<{ cargando?: boolean }>()
const emit = defineEmits<{ submit: [payload: Record<string, unknown>] }>()

const { fetchProductos } = useProductos()

const productos = ref<Producto[]>([])
const clienteDesconocido = ref(false)

const form = reactive({
  n_guia: '',
  cliente_id: '',
  cliente_nombre_libre: '',
  cliente_rut_libre: '',
  cliente_celular_libre: '',
  cliente_ciudad_libre: '',
  producto_id: '',
  descripcion_falla: '',
  fecha_ingreso: new Date().toISOString().slice(0, 10),
  fecha_tope: '',
  observaciones: '',
})

const errores = reactive<Record<string, string>>({})

onMounted(async () => {
  productos.value = (await fetchProductos()).filter((p) => p.estado === 'activo')
})

watch(clienteDesconocido, (esDesconocido) => {
  if (esDesconocido) form.cliente_id = ''
  else {
    form.cliente_nombre_libre = ''
    form.cliente_rut_libre = ''
    form.cliente_celular_libre = ''
    form.cliente_ciudad_libre = ''
  }
})

function validar(): boolean {
  errores.n_guia = form.n_guia.trim() ? '' : 'El N° de guía es obligatorio'
  errores.cliente = clienteDesconocido.value
    ? form.cliente_nombre_libre.trim() ? '' : 'Ingresa al menos el nombre del cliente'
    : form.cliente_id ? '' : 'Debes seleccionar un cliente'
  errores.producto_id = form.producto_id ? '' : 'Debes seleccionar un equipo'
  errores.fecha_ingreso = form.fecha_ingreso ? '' : 'La fecha de ingreso es obligatoria'
  return !Object.values(errores).some(Boolean)
}

function onSubmit() {
  if (!validar()) return

  emit('submit', {
    n_guia: form.n_guia.trim(),
    cliente_id: clienteDesconocido.value ? null : form.cliente_id || null,
    cliente_nombre_libre: clienteDesconocido.value ? form.cliente_nombre_libre.trim() : null,
    cliente_rut_libre: clienteDesconocido.value ? form.cliente_rut_libre.trim() || null : null,
    cliente_celular_libre: clienteDesconocido.value ? form.cliente_celular_libre.trim() || null : null,
    cliente_ciudad_libre: clienteDesconocido.value ? form.cliente_ciudad_libre.trim() || null : null,
    producto_id: form.producto_id,
    descripcion_falla: form.descripcion_falla.trim() || null,
    fecha_ingreso: form.fecha_ingreso,
    fecha_tope: form.fecha_tope || null,
    observaciones: form.observaciones.trim() || null,
  })
}

const inputClase =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]'
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">N° de guía *</label>
      <input v-model="form.n_guia" type="text" :class="inputClase" />
      <p v-if="errores.n_guia" class="text-sm text-red-600 mt-1">{{ errores.n_guia }}</p>
    </div>

    <div>
      <label class="flex items-center gap-2 text-sm text-gray-700 mb-2">
        <input v-model="clienteDesconocido" type="checkbox" />
        Cliente no registrado
      </label>

      <template v-if="!clienteDesconocido">
        <label class="block text-sm font-medium mb-1 text-gray-700">Cliente *</label>
        <ClientesClienteBuscador v-model="form.cliente_id" />
      </template>
      <template v-else>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="block text-sm font-medium mb-1 text-gray-700">Nombre *</label>
            <input v-model="form.cliente_nombre_libre" type="text" :class="inputClase" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700">Rut</label>
            <input v-model="form.cliente_rut_libre" type="text" :class="inputClase" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700">Celular</label>
            <input v-model="form.cliente_celular_libre" type="text" :class="inputClase" />
          </div>
          <div class="col-span-2">
            <label class="block text-sm font-medium mb-1 text-gray-700">Ciudad</label>
            <input v-model="form.cliente_ciudad_libre" type="text" :class="inputClase" />
          </div>
        </div>
      </template>
      <p v-if="errores.cliente" class="text-sm text-red-600 mt-1">{{ errores.cliente }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Equipo *</label>
      <select v-model="form.producto_id" :class="inputClase">
        <option value="">Selecciona un equipo</option>
        <option v-for="p in productos" :key="p.id" :value="p.id">{{ p.nombre }}</option>
      </select>
      <p v-if="errores.producto_id" class="text-sm text-red-600 mt-1">{{ errores.producto_id }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Descripción de la falla</label>
      <textarea v-model="form.descripcion_falla" rows="3" :class="inputClase"></textarea>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Fecha de ingreso *</label>
        <input v-model="form.fecha_ingreso" type="date" :class="inputClase" />
        <p v-if="errores.fecha_ingreso" class="text-sm text-red-600 mt-1">{{ errores.fecha_ingreso }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Fecha tope</label>
        <input v-model="form.fecha_tope" type="date" :class="inputClase" />
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Observaciones</label>
      <textarea v-model="form.observaciones" rows="3" :class="inputClase"></textarea>
    </div>

    <button
      type="submit"
      :disabled="cargando"
      class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {{ cargando ? 'Guardando...' : 'Guardar ticket' }}
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
git add app/components/post-venta/TicketForm.vue
git commit -m "feat: agregar formulario de alta de ticket post venta"
```

---

### Task 8: Componente Kanban `PostVentaTicketBoard.vue`

**Files:**
- Create: `app/components/post-venta/TicketBoard.vue`

**Interfaces:**
- Consumes: `vuedraggable` (ya instalado), `TicketPostVentaConNombres`/`EstadoTicketPostVenta` (Task 5), `colorTicketPostVenta` (Task 6).
- Produces: componente `<PostVentaTicketBoard>` — prop `tickets: TicketPostVentaConNombres[]`; emite `cambiar-estado: [id: string, estado: EstadoTicketPostVenta]`.

- [ ] **Step 1: Escribir el componente**

```vue
<!-- app/components/post-venta/TicketBoard.vue -->
<script setup lang="ts">
import draggable from 'vuedraggable'
import type { TicketPostVentaConNombres, EstadoTicketPostVenta } from '~/composables/useTicketsPostVenta'

const props = defineProps<{ tickets: TicketPostVentaConNombres[] }>()
const emit = defineEmits<{ 'cambiar-estado': [id: string, estado: EstadoTicketPostVenta] }>()

const columnas: { estado: EstadoTicketPostVenta; titulo: string }[] = [
  { estado: 'pendiente_ingreso', titulo: 'Pendiente de ingreso' },
  { estado: 'ingreso_equipo', titulo: 'Ingreso de equipo' },
  { estado: 'probando', titulo: 'Probando' },
  { estado: 'espera_repuesto', titulo: 'Espera de repuesto' },
  { estado: 'listo_despacho', titulo: 'Listo para despacho' },
  { estado: 'despachado', titulo: 'Despachado' },
  { estado: 'desconocido', titulo: 'Desconocido' },
]

// draggable necesita mutar arrays directamente, por eso pasamos de un
// computed de solo lectura a un ref sincronizado con las props (mismo
// patrón que tickets/TicketBoard.vue)
const grupos = ref<Record<string, TicketPostVentaConNombres[]>>({})

function reconstruir() {
  const g: Record<string, TicketPostVentaConNombres[]> = {}
  for (const col of columnas) g[col.estado] = []
  for (const t of props.tickets) g[t.estado]?.push(t)
  grupos.value = g
}

watch(() => props.tickets, reconstruir, { immediate: true, deep: true })

function onDragChange(evt: any, estadoDestino: EstadoTicketPostVenta) {
  if (evt.added) {
    const ticket = evt.added.element as TicketPostVentaConNombres
    emit('cambiar-estado', ticket.id, estadoDestino)
  }
}

function esVencido(ticket: TicketPostVentaConNombres): boolean {
  return !!ticket.fecha_tope && ticket.estado !== 'despachado' && ticket.fecha_tope < new Date().toISOString().slice(0, 10)
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <div class="grid grid-cols-7 gap-3 overflow-x-auto">
    <div
      v-for="col in columnas"
      :key="col.estado"
      class="min-w-[190px] rounded-lg p-3"
      :class="colorTicketPostVenta(col.estado).clases.split(' ')[0]"
    >
      <h3
        class="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center justify-between"
        :class="colorTicketPostVenta(col.estado).clases.split(' ')[1]"
      >
        {{ col.titulo }}
        <span class="opacity-60">{{ grupos[col.estado]?.length ?? 0 }}</span>
      </h3>

      <draggable
        v-model="grupos[col.estado]"
        group="tickets-post-venta"
        item-key="id"
        class="space-y-2 min-h-[80px]"
        @change="(evt) => onDragChange(evt, col.estado)"
      >
        <template #item="{ element: ticket }">
          <div class="border border-gray-100 rounded-xl p-3 bg-white shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between gap-2 mb-2">
              <NuxtLink :to="`/post-venta/${ticket.id}`" class="font-medium text-sm text-gray-800 hover:underline">
                {{ ticket.n_guia }}
              </NuxtLink>
              <span v-if="esVencido(ticket)" class="text-xs text-red-600 font-medium">vencido</span>
            </div>
            <p class="text-xs text-gray-400">{{ ticket.cliente_nombre }}</p>
            <p class="text-[11px] text-gray-500 mt-0.5">{{ ticket.producto_nombre }}</p>
            <p v-if="ticket.fecha_tope" class="text-[11px] mt-0.5" :class="esVencido(ticket) ? 'text-red-600 font-medium' : 'text-gray-400'">
              Tope: {{ formatearFecha(ticket.fecha_tope) }}
            </p>
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Reiniciar dev server**

```bash
rm -rf .nuxt && npm run dev
```

Expected: arranca sin errores (el componente todavía no se usa en ninguna página — se verifica end-to-end en Task 10).

- [ ] **Step 3: Commit**

```bash
git add app/components/post-venta/TicketBoard.vue
git commit -m "feat: agregar kanban de tickets post venta"
```

---

### Task 9: Componente de bitácora `PostVentaSeguimientoTimeline.vue`

**Files:**
- Create: `app/components/post-venta/SeguimientoTimeline.vue`

**Interfaces:**
- Consumes: `useTicketsPostVenta()` (`fetchSeguimientos`, `agregarSeguimiento` — Task 5).
- Produces: componente `<PostVentaSeguimientoTimeline>` — prop `ticketId: string`; emite `registrado: []`.

- [ ] **Step 1: Escribir el componente**

```vue
<!-- app/components/post-venta/SeguimientoTimeline.vue -->
<script setup lang="ts">
import type { TicketPostVentaSeguimiento } from '~/composables/useTicketsPostVenta'

const props = defineProps<{ ticketId: string }>()
const emit = defineEmits<{ registrado: [] }>()
const { fetchSeguimientos, agregarSeguimiento } = useTicketsPostVenta()
const { success, error } = useToast()

const seguimientos = ref<TicketPostVentaSeguimiento[]>([])
const cargando = ref(true)
const guardando = ref(false)

const fecha = ref(new Date().toISOString().slice(0, 10))
const comentario = ref('')

async function cargar() {
  cargando.value = true
  seguimientos.value = await fetchSeguimientos(props.ticketId)
  cargando.value = false
}

watch(() => props.ticketId, cargar, { immediate: true })

async function onSubmit() {
  if (!comentario.value.trim()) return
  guardando.value = true
  try {
    await agregarSeguimiento(props.ticketId, fecha.value, comentario.value.trim())
    comentario.value = ''
    await cargar()
    emit('registrado')
    success('Seguimiento registrado')
  } catch (e) {
    error('No se pudo registrar el seguimiento')
  } finally {
    guardando.value = false
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div>
    <div class="flex flex-wrap gap-2 mb-4">
      <input v-model="fecha" type="date" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <input
        v-model="comentario"
        type="text"
        placeholder="¿Qué se hizo/observó?"
        class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        @keyup.enter="onSubmit"
      />
      <button
        :disabled="guardando || !comentario.trim()"
        class="bg-primary hover:bg-primary-hover text-ink-onprimary px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        @click="onSubmit"
      >
        {{ guardando ? 'Guardando...' : 'Agregar' }}
      </button>
    </div>

    <p v-if="cargando" class="text-sm text-gray-400">Cargando historial...</p>
    <p v-else-if="!seguimientos.length" class="text-sm text-gray-400">Sin seguimientos registrados todavía.</p>

    <ul v-else class="space-y-3">
      <li v-for="s in seguimientos" :key="s.id" class="border-l-2 border-gray-200 pl-3">
        <span class="text-xs text-gray-400">{{ formatearFecha(s.fecha) }}</span>
        <p class="text-sm text-gray-700 mt-1">{{ s.comentario }}</p>
      </li>
    </ul>
  </div>
</template>
```

- [ ] **Step 2: Reiniciar dev server**

```bash
rm -rf .nuxt && npm run dev
```

Expected: arranca sin errores (el componente todavía no se usa en ninguna página — se verifica end-to-end en Task 11).

- [ ] **Step 3: Commit**

```bash
git add app/components/post-venta/SeguimientoTimeline.vue
git commit -m "feat: agregar bitacora de seguimiento de ticket post venta"
```

---

### Task 10: Página `/post-venta` (Kanban) + entrada de navegación

**Files:**
- Create: `app/pages/post-venta/index.vue`
- Modify: `app/layouts/default.vue`

**Interfaces:**
- Consumes: `useTicketsPostVenta()` (Task 5), `PostVentaTicketBoard` (Task 8), `PostVentaTicketForm` (Task 7), `SharedModal`, `SharedPageHeader`.

- [ ] **Step 1: Escribir la página**

```vue
<!-- app/pages/post-venta/index.vue -->
<script setup lang="ts">
import type { EstadoTicketPostVenta, TicketPostVentaConNombres } from '~/composables/useTicketsPostVenta'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets_post_venta', actions: ['view'] },
})

const { fetchTickets, crearTicket, actualizarTicket } = useTicketsPostVenta()
const { success, error } = useToast()
const { can } = usePermissions()

const tickets = ref<TicketPostVentaConNombres[]>([])
const cargando = ref(true)
const guardando = ref(false)
const modalAbierto = ref(false)

async function cargar() {
  cargando.value = true
  tickets.value = await fetchTickets()
  cargando.value = false
}

onMounted(cargar)

async function onSubmit(payload: Record<string, unknown>) {
  guardando.value = true
  try {
    await crearTicket(payload as any)
    success('Ticket creado')
    modalAbierto.value = false
    await cargar()
  } catch (e) {
    error('No se pudo crear el ticket. Intenta de nuevo.')
  } finally {
    guardando.value = false
  }
}

async function onCambiarEstado(id: string, estado: EstadoTicketPostVenta) {
  try {
    await actualizarTicket(id, { estado })
    await cargar()
  } catch (e) {
    error('No se pudo actualizar el estado')
  }
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Post Venta">
      <template #accion>
        <button
          v-if="can('tickets_post_venta', 'create')"
          class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          @click="modalAbierto = true"
        >
          + Nuevo ticket
        </button>
      </template>
    </SharedPageHeader>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <PostVentaTicketBoard v-else :tickets="tickets" @cambiar-estado="onCambiarEstado" />

    <SharedModal :open="modalAbierto" titulo="Nuevo ticket de post venta" @cerrar="modalAbierto = false">
      <PostVentaTicketForm :cargando="guardando" @submit="onSubmit" />
    </SharedModal>
  </div>
</template>
```

- [ ] **Step 2: Agregar la entrada de navegación**

En `app/layouts/default.vue`, el array `navCrm` actual (líneas 16-21):

```ts
const navCrm = [
  { path: '/clientes', label: 'Clientes', permiso: ['view', 'view_all'] as const, resource: 'clientes' },
  { path: '/leads', label: 'Leads', permiso: ['view', 'view_all'] as const, resource: 'leads' },
  { path: '/tickets', label: 'Tickets', permiso: ['view', 'view_all'] as const, resource: 'tickets' },
  { path: '/productos', label: 'Productos', permiso: ['view', 'view_all'] as const, resource: 'productos' },
]
```

Reemplazar por (agrega la última línea; `tickets_post_venta` solo tiene permiso `view`, sin `view_all`, así que se repite `'view'` en las dos posiciones que el `v-show` existente ya chequea):

```ts
const navCrm = [
  { path: '/clientes', label: 'Clientes', permiso: ['view', 'view_all'] as const, resource: 'clientes' },
  { path: '/leads', label: 'Leads', permiso: ['view', 'view_all'] as const, resource: 'leads' },
  { path: '/tickets', label: 'Tickets', permiso: ['view', 'view_all'] as const, resource: 'tickets' },
  { path: '/productos', label: 'Productos', permiso: ['view', 'view_all'] as const, resource: 'productos' },
  { path: '/post-venta', label: 'Post Venta', permiso: ['view', 'view'] as const, resource: 'tickets_post_venta' },
]
```

- [ ] **Step 3: Reiniciar dev server y probar en el navegador**

```bash
rm -rf .nuxt && npm run dev
```

Con la cuenta `n.quevedo@integrakin.cl` (ya tiene el rol `post_venta`):
1. Login, confirmar que aparece "Post Venta" en el nav (sección CRM).
2. Entrar a `/post-venta`, confirmar que se ven las 7 columnas del Kanban (vacías).
3. Click "+ Nuevo ticket", completar N° guía, cliente (buscar uno real), equipo, fecha de ingreso, guardar.
4. Confirmar que la tarjeta aparece en la columna "Pendiente de ingreso".
5. Arrastrar la tarjeta a "Probando" — confirmar que se mueve y persiste tras recargar.
6. Crear un segundo ticket marcando "Cliente no registrado", completar nombre libre — confirmar que se muestra igual en el Kanban con ese nombre.

Expected: los 6 pasos funcionan sin errores en consola.

- [ ] **Step 4: Commit**

```bash
git add app/pages/post-venta/index.vue app/layouts/default.vue
git commit -m "feat: agregar pagina /post-venta con kanban y alta de tickets"
```

---

### Task 11: Página de detalle `/post-venta/[id]`

**Files:**
- Create: `app/pages/post-venta/[id].vue`

**Interfaces:**
- Consumes: `useTicketsPostVenta()` (`getTicket`, `actualizarTicket` — Task 5), `PostVentaSeguimientoTimeline` (Task 9), `colorTicketPostVenta` (Task 6), `SharedPageHeader`, `SharedCard`, `SharedBadge`.

- [ ] **Step 1: Escribir la página**

```vue
<!-- app/pages/post-venta/[id].vue -->
<script setup lang="ts">
import type { TicketPostVentaConNombres, EstadoTicketPostVenta } from '~/composables/useTicketsPostVenta'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets_post_venta', actions: ['view'] },
})

const route = useRoute()
const { getTicket, actualizarTicket } = useTicketsPostVenta()
const { can } = usePermissions()
const { success, error } = useToast()

const ticket = ref<TicketPostVentaConNombres | null>(null)
const cargando = ref(true)
const guardando = ref(false)

const estados: EstadoTicketPostVenta[] = [
  'pendiente_ingreso', 'ingreso_equipo', 'probando',
  'espera_repuesto', 'listo_despacho', 'despachado', 'desconocido',
]

async function cargar() {
  ticket.value = await getTicket(route.params.id as string)
  cargando.value = false
}

onMounted(cargar)

async function onCambiarEstado(estado: EstadoTicketPostVenta) {
  if (!ticket.value) return
  guardando.value = true
  try {
    ticket.value = { ...ticket.value, ...(await actualizarTicket(ticket.value.id, { estado })) }
    success('Estado actualizado')
  } catch (e) {
    error('No se pudo actualizar el estado')
  } finally {
    guardando.value = false
  }
}

async function onCambiarFechaDespacho(fecha: string) {
  if (!ticket.value) return
  guardando.value = true
  try {
    ticket.value = { ...ticket.value, ...(await actualizarTicket(ticket.value.id, { fecha_despacho: fecha || null })) }
    success('Fecha de despacho actualizada')
  } catch (e) {
    error('No se pudo actualizar la fecha de despacho')
  } finally {
    guardando.value = false
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="p-6">
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <template v-else-if="ticket">
      <SharedPageHeader :titulo="`Guía ${ticket.n_guia}`" volver-a="/post-venta">
        <template #subtitulo>Ingresado el {{ formatearFecha(ticket.fecha_ingreso) }}</template>
        <template #accion>
          <SharedBadge :label="colorTicketPostVenta(ticket.estado).label" :clases="colorTicketPostVenta(ticket.estado).clases" tamano="lg" />
        </template>
      </SharedPageHeader>

      <div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 items-start">
        <SharedCard titulo="Datos del ticket">
          <div class="space-y-3 text-sm">
            <p><span class="text-gray-400">Cliente:</span> {{ ticket.cliente_nombre }}</p>
            <p v-if="ticket.cliente_rut_libre"><span class="text-gray-400">Rut:</span> {{ ticket.cliente_rut_libre }}</p>
            <p v-if="ticket.cliente_celular_libre"><span class="text-gray-400">Celular:</span> {{ ticket.cliente_celular_libre }}</p>
            <p v-if="ticket.cliente_ciudad_libre"><span class="text-gray-400">Ciudad:</span> {{ ticket.cliente_ciudad_libre }}</p>
            <p><span class="text-gray-400">Equipo:</span> {{ ticket.producto_nombre }}</p>
            <p v-if="ticket.descripcion_falla"><span class="text-gray-400">Falla:</span> {{ ticket.descripcion_falla }}</p>
            <p v-if="ticket.fecha_tope"><span class="text-gray-400">Fecha tope:</span> {{ formatearFecha(ticket.fecha_tope) }}</p>
            <p v-if="ticket.observaciones"><span class="text-gray-400">Observaciones:</span> {{ ticket.observaciones }}</p>

            <div v-if="can('tickets_post_venta', 'edit')" class="pt-3 border-t border-gray-100 space-y-3">
              <div>
                <label class="block text-xs font-medium mb-1 text-gray-700">Estado</label>
                <select
                  :value="ticket.estado"
                  :disabled="guardando"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  @change="onCambiarEstado(($event.target as HTMLSelectElement).value as EstadoTicketPostVenta)"
                >
                  <option v-for="e in estados" :key="e" :value="e">{{ colorTicketPostVenta(e).label }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium mb-1 text-gray-700">Fecha de despacho</label>
                <input
                  :value="ticket.fecha_despacho ?? ''"
                  type="date"
                  :disabled="guardando"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  @change="onCambiarFechaDespacho(($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
        </SharedCard>

        <SharedCard titulo="Seguimiento">
          <PostVentaSeguimientoTimeline :ticket-id="ticket.id" />
        </SharedCard>
      </div>
    </template>
    <p v-else class="text-red-600">Ticket no encontrado</p>
  </div>
</template>
```

- [ ] **Step 2: Reiniciar dev server y probar en el navegador**

```bash
rm -rf .nuxt && npm run dev
```

Con la cuenta `n.quevedo@integrakin.cl`:
1. Desde `/post-venta`, click en la guía de un ticket creado en Task 10 — entra al detalle en `/post-venta/{id}`.
2. Cambiar el `select` de Estado a "Listo para despacho" — confirmar que el badge del header se actualiza.
3. Completar la fecha de despacho — confirmar que persiste tras recargar.
4. En la card "Seguimiento", agregar un comentario con fecha de hoy — confirmar que aparece en la lista.
5. Agregar un segundo seguimiento — confirmar que ambos quedan visibles, más reciente primero.
6. Volver a `/post-venta` (link "Volver" del header) — confirmar que el Kanban refleja el nuevo estado.

Expected: los 6 pasos funcionan sin errores en consola.

- [ ] **Step 3: Commit**

```bash
git add app/pages/post-venta/[id].vue
git commit -m "feat: agregar pagina de detalle de ticket post venta con bitacora"
```

---

### Task 12: Actualizar `CONTEXTO_PROYECTO.md`

**Files:**
- Modify: `CONTEXTO_PROYECTO.md`

**Interfaces:** ninguna — solo documentación.

- [ ] **Step 1: Agregar las migraciones nuevas a la lista**

En la sección `### Migraciones SQL` (bloque de código que termina en `20260714080000_notificacion_citas_vencidas.sql`), agregar al final:

```
20260714200000_tickets_post_venta.sql
20260714210000_tickets_post_venta_seguimientos.sql
20260714220000_notificacion_tickets_post_venta_vencidos.sql
```

- [ ] **Step 2: Agregar las páginas, composable y componentes nuevos**

En `### Páginas`, después de `capacitaciones/index.vue`, agregar:
```
post-venta/index.vue           — kanban de tickets post-venta (7 estados)
post-venta/[id].vue            — detalle con cambio de estado + bitácora de seguimiento
```

En `### Composables`, agregar `useTicketsPostVenta` a la lista alfabética (entre `useTecnicos` y `useTickets`).

En `### Componentes`, agregar una línea de módulo nueva después de `leads/...`:
```
post-venta/SeguimientoTimeline.vue, post-venta/TicketBoard.vue, post-venta/TicketForm.vue
```

- [ ] **Step 3: Agregar entrada al Roadmap**

Al final de la sección `## Roadmap — estado actual` (después del punto 28, Agenda de capacitaciones), agregar:

```
29. ✅ **Tickets de post-venta** — sistema propio para el equipo de
    post_venta (reparación/garantía de equipos), separado del `tickets`
    de servicio_técnico. Tabla `tickets_post_venta` sin `owner_id` (todo
    el equipo ve/edita todo por igual), cliente opcionalmente "no
    registrado" (campos libres en la misma fila, sin tabla aparte),
    bitácora de seguimiento (`tickets_post_venta_seguimientos`), cron de
    vencidos que notifica a todo el rol `post_venta` (broadcast, no
    owner individual). Página `/post-venta` con Kanban de 7 estados +
    detalle con bitácora (ver spec
    `2026-07-14-tickets-post-venta-design.md`).
```

Actualizar la fecha de "Última actualización" al tope del documento a la fecha en que se ejecute esta tarea.

- [ ] **Step 4: Commit**

```bash
git add CONTEXTO_PROYECTO.md
git commit -m "docs: actualizar contexto con el sistema de tickets post venta"
```

---

## Self-Review Notes

- **Cobertura de la spec:** modelo de datos (Task 1), bitácora (Task 2), cron de vencidos + broadcast a `post_venta` (Task 3), campana (Task 4), composable (Task 5), badge de estado (Task 6), formulario (Task 7), Kanban (Task 8), timeline de seguimiento (Task 9), página + nav (Task 10), detalle (Task 11), doc (Task 12). Las secciones "Alternativas descartadas" y "Fuera de alcance" de la spec no generan tareas a propósito (tabla aparte para desconocidos, `owner_id`, reasignación, borrado, vínculo con `ventas` — ninguno se implementa).
- **Placeholders:** ninguno — cada paso tiene código completo o comando exacto. (Verificado con `grep -n "post.venta\|post_venta" CONTEXTO_PROYECTO.md` que no hay ninguna línea en "Pendientes sueltos" sobre este sistema que haya que limpiar en Task 12.)
- **Consistencia de tipos:** `TicketPostVenta`/`TicketPostVentaConNombres`/`TicketPostVentaSeguimiento`/`EstadoTicketPostVenta` (Task 5) se usan sin cambios en Tasks 7, 8, 9, 10 y 11; `colorTicketPostVenta` (Task 6) se usa con el mismo nombre en Tasks 8 y 11; el componente `<PostVentaTicketForm>`/`<PostVentaTicketBoard>`/`<PostVentaSeguimientoTimeline>` (auto-import por convención de carpeta `app/components/post-venta/`) se referencian igual en Tasks 10 y 11.
