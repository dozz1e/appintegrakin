# Historial de estados y archivado automático — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar historial de cambios de estado y un archivado automático (no destructivo) de leads/tickets/tickets_post_venta cerrados, con páginas de "historial de movimientos" e "historial de cerrados" por módulo, configuración global de días por módulo, y reestructura del nav.

**Architecture:** Tabla genérica `historial_estados` (patrón `entidad_tipo`/`entidad_id`, igual que `notificaciones`) con trigger reutilizable en las 3 tablas. Columnas `fecha_cierre`/`archivado` en `leads`/`tickets`/`tickets_post_venta`, gestionadas por trigger `before update` propio de cada tabla. Cron diario (`fn_archivar_cerrados`) que archiva (nunca borra) usando una tabla de configuración global `configuracion_archivado` (3 filas, una por módulo). 6 páginas nuevas (2 por módulo) + reestructura del sidebar + 3 campos nuevos en el modal de Configuración existente, visibles solo para cuentas con rol `post_venta`.

**Tech Stack:** Nuxt 4 / Vue 3 / Supabase (Postgres + RLS + `pg_cron`) — mismo stack que el resto del repo, sin librerías nuevas.

## Global Constraints

- Spec completo: `docs/superpowers/specs/2026-07-15-historial-estados-archivado-design.md`.
- "Borrar" = archivar (columna `archivado`), **nunca** `delete`. Ningún dato se pierde.
- Estados de cierre: `leads` → `ganado`/`perdido`; `tickets` → `resuelto`/`cerrado`; `tickets_post_venta` → `despachado` (`desconocido` NO cierra).
- Los días de archivado son un **valor global por módulo** (no por usuario) — viven en la tabla `configuracion_archivado`, no en `profiles.settings`.
- "Historial de cerrados" muestra **todos** los cerrados desde siempre, sin filtrar por `archivado` — solo el listado activo (Kanban/tabla principal) filtra `archivado = false`.
- **No hay suite de tests automatizada en este proyecto.** Verificación manual: SQL directo (`mcp__supabase__execute_sql`) para migraciones, navegador para UI, con `rm -rf .nuxt && npm run dev` tras crear composables/páginas nuevas (gotcha #2 de `CONTEXTO_PROYECTO.md`).

---

### Task 1: Migración — tabla `historial_estados` + trigger + RLS

**Files:**
- Create: `supabase/migrations/20260715000000_historial_estados.sql`

**Interfaces:**
- Produces: tabla `historial_estados(id, entidad_tipo, entidad_id, estado_anterior, estado_nuevo, created_by, created_at)`, función `registrar_historial_estado()`, triggers `historial_estado_leads`/`historial_estado_tickets`/`historial_estado_tickets_post_venta`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260715000000_historial_estados.sql
--
-- Historial de cambios de estado para leads/tickets/tickets_post_venta,
-- tabla genérica (mismo patrón entidad_tipo/entidad_id que notificaciones)
-- en vez de una tabla por módulo. Ver spec
-- 2026-07-15-historial-estados-archivado-design.md.

create table historial_estados (
  id uuid primary key default gen_random_uuid(),
  entidad_tipo text check (entidad_tipo in ('lead', 'ticket', 'ticket_post_venta')) not null,
  entidad_id uuid not null,
  estado_anterior text,
  estado_nuevo text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_historial_estados_entidad on historial_estados(entidad_tipo, entidad_id);

alter table historial_estados enable row level security;

create policy select_historial_estados on historial_estados
for select using (
  (entidad_tipo = 'lead' and (has_permission(auth.uid(), 'leads', 'view') or has_permission(auth.uid(), 'leads', 'view_all')))
  or (entidad_tipo = 'ticket' and (has_permission(auth.uid(), 'tickets', 'view') or has_permission(auth.uid(), 'tickets', 'view_all')))
  or (entidad_tipo = 'ticket_post_venta' and has_permission(auth.uid(), 'tickets_post_venta', 'view'))
);

create or replace function registrar_historial_estado()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.estado is distinct from old.estado then
    insert into historial_estados (entidad_tipo, entidad_id, estado_anterior, estado_nuevo, created_by)
    values (tg_argv[0], new.id, old.estado, new.estado, auth.uid());
  end if;
  return new;
end;
$$;

create trigger historial_estado_leads after update on leads
  for each row execute function registrar_historial_estado('lead');

create trigger historial_estado_tickets after update on tickets
  for each row execute function registrar_historial_estado('ticket');

create trigger historial_estado_tickets_post_venta after update on tickets_post_venta
  for each row execute function registrar_historial_estado('ticket_post_venta');
```

- [ ] **Step 2: Aplicar la migración**

Aplicar con `mcp__supabase__apply_migration` (`name: "historial_estados"`).

Expected: `{"success": true}`.

- [ ] **Step 3: Verificar que el trigger registra un cambio de estado**

```sql
-- crear un lead de prueba y cambiarle el estado
insert into leads (nombre, estado) values ('TEST-HISTORIAL', 'nuevo') returning id;
-- usar el id devuelto:
update leads set estado = 'contactado' where nombre = 'TEST-HISTORIAL';

select entidad_tipo, estado_anterior, estado_nuevo from historial_estados
where entidad_id = (select id from leads where nombre = 'TEST-HISTORIAL');
```

Expected: 1 fila, `entidad_tipo='lead'`, `estado_anterior='nuevo'`, `estado_nuevo='contactado'`.

Limpiar después:
```sql
delete from historial_estados where entidad_id = (select id from leads where nombre = 'TEST-HISTORIAL');
delete from leads where nombre = 'TEST-HISTORIAL';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260715000000_historial_estados.sql
git commit -m "feat: agregar historial de cambios de estado (leads, tickets, post venta)"
```

---

### Task 2: Migración — `fecha_cierre`/`archivado` + trigger de cierre

**Files:**
- Create: `supabase/migrations/20260715010000_cierre_archivado.sql`

**Interfaces:**
- Consumes: tablas `leads`, `tickets`, `tickets_post_venta` (existentes).
- Produces: columnas `fecha_cierre timestamptz`, `archivado boolean` en las 3 tablas; funciones/triggers `fn_gestionar_cierre_leads`/`fn_gestionar_cierre_tickets`/`fn_gestionar_cierre_tickets_post_venta`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260715010000_cierre_archivado.sql
--
-- Columnas fecha_cierre/archivado + trigger que las gestiona al entrar o
-- salir de un estado de cierre, por módulo. archivado lo pone en true un
-- cron aparte (ver 20260715030000_cron_archivar_cerrados.sql) - acá solo
-- se resetea a false si el registro se reabre. Ver spec
-- 2026-07-15-historial-estados-archivado-design.md.

alter table leads add column fecha_cierre timestamptz;
alter table leads add column archivado boolean not null default false;

alter table tickets add column fecha_cierre timestamptz;
alter table tickets add column archivado boolean not null default false;

alter table tickets_post_venta add column fecha_cierre timestamptz;
alter table tickets_post_venta add column archivado boolean not null default false;

create or replace function fn_gestionar_cierre_leads()
returns trigger
language plpgsql
as $$
begin
  if new.estado in ('ganado', 'perdido') and old.estado not in ('ganado', 'perdido') then
    new.fecha_cierre := now();
  elsif new.estado not in ('ganado', 'perdido') and old.estado in ('ganado', 'perdido') then
    new.fecha_cierre := null;
    new.archivado := false;
  end if;
  return new;
end;
$$;

create trigger gestionar_cierre_leads before update on leads
  for each row execute function fn_gestionar_cierre_leads();

create or replace function fn_gestionar_cierre_tickets()
returns trigger
language plpgsql
as $$
begin
  if new.estado in ('resuelto', 'cerrado') and old.estado not in ('resuelto', 'cerrado') then
    new.fecha_cierre := now();
  elsif new.estado not in ('resuelto', 'cerrado') and old.estado in ('resuelto', 'cerrado') then
    new.fecha_cierre := null;
    new.archivado := false;
  end if;
  return new;
end;
$$;

create trigger gestionar_cierre_tickets before update on tickets
  for each row execute function fn_gestionar_cierre_tickets();

create or replace function fn_gestionar_cierre_tickets_post_venta()
returns trigger
language plpgsql
as $$
begin
  if new.estado = 'despachado' and old.estado <> 'despachado' then
    new.fecha_cierre := now();
  elsif new.estado <> 'despachado' and old.estado = 'despachado' then
    new.fecha_cierre := null;
    new.archivado := false;
  end if;
  return new;
end;
$$;

create trigger gestionar_cierre_tickets_post_venta before update on tickets_post_venta
  for each row execute function fn_gestionar_cierre_tickets_post_venta();
```

- [ ] **Step 2: Aplicar la migración**

`mcp__supabase__apply_migration` (`name: "cierre_archivado"`).

Expected: `{"success": true}`.

- [ ] **Step 3: Verificar que `fecha_cierre` se setea y se limpia**

```sql
insert into leads (nombre, estado) values ('TEST-CIERRE', 'nuevo') returning id;

update leads set estado = 'ganado' where nombre = 'TEST-CIERRE';
select fecha_cierre, archivado from leads where nombre = 'TEST-CIERRE';
-- Expected: fecha_cierre no nulo, archivado = false

update leads set estado = 'contactado' where nombre = 'TEST-CIERRE';
select fecha_cierre, archivado from leads where nombre = 'TEST-CIERRE';
-- Expected: fecha_cierre nulo, archivado = false
```

Limpiar después:
```sql
delete from historial_estados where entidad_id = (select id from leads where nombre = 'TEST-CIERRE');
delete from leads where nombre = 'TEST-CIERRE';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260715010000_cierre_archivado.sql
git commit -m "feat: agregar fecha_cierre y archivado a leads, tickets y post venta"
```

---

### Task 3: Migración — tabla `configuracion_archivado` + permiso

**Files:**
- Create: `supabase/migrations/20260715020000_configuracion_archivado.sql`

**Interfaces:**
- Produces: tabla `configuracion_archivado(modulo, dias)` con 3 filas semilla, permiso `configuracion_archivado.edit` asignado a `post_venta` y `dueña`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260715020000_configuracion_archivado.sql
--
-- Valor global (no por usuario) de días antes de archivar cerrados, uno
-- por módulo. Lo usa el cron fn_archivar_cerrados. Editable solo por
-- cuentas con rol post_venta o dueña, desde el modal de Configuración
-- (ver Task 13). Ver spec 2026-07-15-historial-estados-archivado-design.md.

create table configuracion_archivado (
  modulo text primary key check (modulo in ('leads', 'tickets', 'tickets_post_venta')),
  dias integer not null check (dias > 0)
);

insert into configuracion_archivado (modulo, dias) values
  ('leads', 30), ('tickets', 30), ('tickets_post_venta', 30);

alter table configuracion_archivado enable row level security;

create policy select_configuracion_archivado on configuracion_archivado
for select using (auth.uid() is not null);

create policy update_configuracion_archivado on configuracion_archivado
for update using (has_permission(auth.uid(), 'configuracion_archivado', 'edit'));

insert into permissions (resource, action) values
  ('configuracion_archivado', 'edit')
on conflict (resource, action) do nothing;

do $$
declare
  r_id uuid;
  p_id uuid;
  matriz jsonb := '{
    "dueña":      ["configuracion_archivado.edit"],
    "post_venta": ["configuracion_archivado.edit"]
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

`mcp__supabase__apply_migration` (`name: "configuracion_archivado"`).

Expected: `{"success": true}`.

- [ ] **Step 3: Verificar filas semilla y permisos**

```sql
select modulo, dias from configuracion_archivado order by modulo;
```

Expected: 3 filas, `dias=30` cada una.

```sql
select r.name, p.resource, p.action
from role_permissions rp
join roles r on r.id = rp.role_id
join permissions p on p.id = rp.permission_id
where p.resource = 'configuracion_archivado';
```

Expected: 2 filas (`dueña`, `post_venta`), ambas `action='edit'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260715020000_configuracion_archivado.sql
git commit -m "feat: agregar configuracion_archivado con dias globales por modulo"
```

---

### Task 4: Migración — cron de archivado

**Files:**
- Create: `supabase/migrations/20260715030000_cron_archivar_cerrados.sql`

**Interfaces:**
- Consumes: `configuracion_archivado` (Task 3), columnas `fecha_cierre`/`archivado` (Task 2).
- Produces: función `fn_archivar_cerrados()`, cron job `archivar-cerrados` (diario, 3 AM).

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260715030000_cron_archivar_cerrados.sql
--
-- Archiva (nunca borra) leads/tickets/tickets_post_venta cerrados hace más
-- de los días configurados en configuracion_archivado. Corre una vez al
-- día (no hace falta más frecuencia para una ventana de días). Ver spec
-- 2026-07-15-historial-estados-archivado-design.md.

create or replace function fn_archivar_cerrados()
returns void
language plpgsql
security definer
as $$
begin
  update leads set archivado = true
  where estado in ('ganado', 'perdido') and not archivado
    and fecha_cierre < now() - (
      (select dias from configuracion_archivado where modulo = 'leads') || ' days'
    )::interval;

  update tickets set archivado = true
  where estado in ('resuelto', 'cerrado') and not archivado
    and fecha_cierre < now() - (
      (select dias from configuracion_archivado where modulo = 'tickets') || ' days'
    )::interval;

  update tickets_post_venta set archivado = true
  where estado = 'despachado' and not archivado
    and fecha_cierre < now() - (
      (select dias from configuracion_archivado where modulo = 'tickets_post_venta') || ' days'
    )::interval;
end;
$$;

select cron.schedule('archivar-cerrados', '0 3 * * *', $$select fn_archivar_cerrados()$$);
```

- [ ] **Step 2: Aplicar la migración**

`mcp__supabase__apply_migration` (`name: "cron_archivar_cerrados"`).

Expected: `{"success": true}`.

- [ ] **Step 3: Verificar que el cron existe**

```sql
select jobname, schedule from cron.job where jobname = 'archivar-cerrados';
```

Expected: 1 fila, `schedule = '0 3 * * *'`.

- [ ] **Step 4: Probar la función manualmente**

```sql
insert into leads (nombre, estado) values ('TEST-ARCHIVAR', 'ganado') returning id;
-- fecha_cierre quedó en "ahora" por el trigger de Task 2; forzarla a 40 días atrás:
update leads set fecha_cierre = now() - interval '40 days' where nombre = 'TEST-ARCHIVAR';

select fn_archivar_cerrados();

select archivado from leads where nombre = 'TEST-ARCHIVAR';
```

Expected: `archivado = true` (30 días configurados < 40 días de antigüedad).

Limpiar después:
```sql
delete from historial_estados where entidad_id = (select id from leads where nombre = 'TEST-ARCHIVAR');
delete from leads where nombre = 'TEST-ARCHIVAR';
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260715030000_cron_archivar_cerrados.sql
git commit -m "feat: agregar cron diario de archivado de cerrados"
```

---

### Task 5: `useLeads.ts` — filtro de archivado + historial + cerrados

**Files:**
- Modify: `app/composables/useLeads.ts`

**Interfaces:**
- Consumes: columnas `fecha_cierre`/`archivado` (Task 2).
- Produces: `Lead` con `fecha_cierre: string | null` y `archivado: boolean`; `fetchLeadsPorIds(ids: string[]): Promise<Pick<Lead,'id'|'nombre'>[]>`; `fetchCerrados(): Promise<Lead[]>`. `fetchLeads()` ahora excluye archivados.

- [ ] **Step 1: Agregar los campos nuevos a la interfaz `Lead`**

La interfaz actual:

```ts
export interface Lead {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  origen: string | null
  estado: EstadoLead
  cliente_id: string | null
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
}
```

Reemplazar por:

```ts
export interface Lead {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  origen: string | null
  estado: EstadoLead
  cliente_id: string | null
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
  fecha_cierre: string | null
  archivado: boolean
}
```

- [ ] **Step 2: Filtrar archivados en `fetchLeads`**

La función actual:

```ts
  const fetchLeads = async (filtroEstado?: EstadoLead) => {
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (filtroEstado) query = query.eq('estado', filtroEstado)
    const { data, error } = await query
    if (error) throw error
    return data as Lead[]
  }
```

Reemplazar por:

```ts
  const fetchLeads = async (filtroEstado?: EstadoLead) => {
    let query = supabase.from('leads').select('*').eq('archivado', false).order('created_at', { ascending: false })
    if (filtroEstado) query = query.eq('estado', filtroEstado)
    const { data, error } = await query
    if (error) throw error
    return data as Lead[]
  }
```

- [ ] **Step 3: Agregar `fetchLeadsPorIds` y `fetchCerrados`**

Justo después de `deleteLead`, agregar:

```ts
  const fetchLeadsPorIds = async (ids: string[]): Promise<Pick<Lead, 'id' | 'nombre'>[]> => {
    if (!ids.length) return []
    const { data, error } = await supabase.from('leads').select('id, nombre').in('id', ids)
    if (error) throw error
    return data as Pick<Lead, 'id' | 'nombre'>[]
  }

  const fetchCerrados = async (): Promise<Lead[]> => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .in('estado', ['ganado', 'perdido'])
      .order('fecha_cierre', { ascending: false })
    if (error) throw error
    return data as Lead[]
  }
```

- [ ] **Step 4: Agregarlas al `return`**

El `return` actual:

```ts
  return {
    fetchLeads,
    getLead,
    createLead,
    updateLead,
    deleteLead,
    cambiarEstado,
    asignarLead,
    convertirACliente,
    importLeads,
  }
```

Reemplazar por:

```ts
  return {
    fetchLeads,
    getLead,
    createLead,
    updateLead,
    deleteLead,
    cambiarEstado,
    asignarLead,
    convertirACliente,
    importLeads,
    fetchLeadsPorIds,
    fetchCerrados,
  }
```

- [ ] **Step 5: Reiniciar dev server**

```bash
rm -rf .nuxt && npm run dev
```

Expected: arranca sin errores.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useLeads.ts
git commit -m "feat: filtrar archivados y agregar historial/cerrados a useLeads"
```

---

### Task 6: `useTickets.ts` — filtro de archivado + historial + cerrados

**Files:**
- Modify: `app/composables/useTickets.ts`

**Interfaces:**
- Consumes: columnas `fecha_cierre`/`archivado` (Task 2).
- Produces: `Ticket` con `fecha_cierre: string | null` y `archivado: boolean`; `fetchTicketsPorIds(ids: string[]): Promise<Pick<Ticket,'id'|'titulo'>[]>`; `fetchCerrados(): Promise<Ticket[]>`. `fetchTickets()` ahora excluye archivados.

- [ ] **Step 1: Agregar los campos nuevos a la interfaz `Ticket`**

La interfaz actual:

```ts
export interface Ticket {
  id: string
  cliente_id: string
  titulo: string
  descripcion: string | null
  estado: EstadoTicket
  prioridad: PrioridadTicket
  owner_id: string | null
  tecnico_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
  clientes?: { razon_social: string } | null
}
```

Reemplazar por:

```ts
export interface Ticket {
  id: string
  cliente_id: string
  titulo: string
  descripcion: string | null
  estado: EstadoTicket
  prioridad: PrioridadTicket
  owner_id: string | null
  tecnico_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
  fecha_cierre: string | null
  archivado: boolean
  clientes?: { razon_social: string } | null
}
```

- [ ] **Step 2: Filtrar archivados en `fetchTickets`**

La función actual:

```ts
  const fetchTickets = async (filtroEstado?: EstadoTicket) => {
    let query = supabase
      .from('tickets')
      .select('*, clientes(razon_social)')
      .order('created_at', { ascending: false })
    if (filtroEstado) query = query.eq('estado', filtroEstado)
    const { data, error } = await query
    if (error) throw error
    return data as unknown as Ticket[]
  }
```

Reemplazar por:

```ts
  const fetchTickets = async (filtroEstado?: EstadoTicket) => {
    let query = supabase
      .from('tickets')
      .select('*, clientes(razon_social)')
      .eq('archivado', false)
      .order('created_at', { ascending: false })
    if (filtroEstado) query = query.eq('estado', filtroEstado)
    const { data, error } = await query
    if (error) throw error
    return data as unknown as Ticket[]
  }
```

- [ ] **Step 3: Agregar `fetchTicketsPorIds` y `fetchCerrados`**

Justo después de `deleteTicket`, agregar:

```ts
  const fetchTicketsPorIds = async (ids: string[]): Promise<Pick<Ticket, 'id' | 'titulo'>[]> => {
    if (!ids.length) return []
    const { data, error } = await supabase.from('tickets').select('id, titulo').in('id', ids)
    if (error) throw error
    return data as Pick<Ticket, 'id' | 'titulo'>[]
  }

  const fetchCerrados = async (): Promise<Ticket[]> => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*, clientes(razon_social)')
      .in('estado', ['resuelto', 'cerrado'])
      .order('fecha_cierre', { ascending: false })
    if (error) throw error
    return data as unknown as Ticket[]
  }
```

- [ ] **Step 4: Agregarlas al `return`**

El `return` actual:

```ts
  return {
    fetchTickets,
    fetchTicketsPorCliente,
    getTicket,
    createTicket,
    updateTicket,
    deleteTicket,
    cambiarEstado,
    asignarTecnico,
  }
```

Reemplazar por:

```ts
  return {
    fetchTickets,
    fetchTicketsPorCliente,
    getTicket,
    createTicket,
    updateTicket,
    deleteTicket,
    cambiarEstado,
    asignarTecnico,
    fetchTicketsPorIds,
    fetchCerrados,
  }
```

- [ ] **Step 5: Reiniciar dev server**

```bash
rm -rf .nuxt && npm run dev
```

Expected: arranca sin errores.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useTickets.ts
git commit -m "feat: filtrar archivados y agregar historial/cerrados a useTickets"
```

---

### Task 7: `useTicketsPostVenta.ts` — filtro de archivado + historial + cerrados

**Files:**
- Modify: `app/composables/useTicketsPostVenta.ts`

**Interfaces:**
- Consumes: columnas `fecha_cierre`/`archivado` (Task 2).
- Produces: `TicketPostVenta` con `fecha_cierre: string | null` y `archivado: boolean`; `fetchTicketsPorIds(ids: string[]): Promise<Pick<TicketPostVenta,'id'|'n_guia'>[]>`; `fetchCerrados(): Promise<TicketPostVentaConNombres[]>`. `fetchTickets()` ahora excluye archivados.

- [ ] **Step 1: Agregar los campos nuevos a la interfaz `TicketPostVenta`**

Ubicar la interfaz (después de `notificada_vencida: boolean`):

```ts
  notificada_vencida: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}
```

Reemplazar por:

```ts
  notificada_vencida: boolean
  fecha_cierre: string | null
  archivado: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Agregar los campos nuevos en `mapearFila`**

La función actual:

```ts
    notificada_vencida: fila.notificada_vencida,
    created_by: fila.created_by,
    created_at: fila.created_at,
    updated_at: fila.updated_at,
```

Reemplazar por:

```ts
    notificada_vencida: fila.notificada_vencida,
    fecha_cierre: fila.fecha_cierre,
    archivado: fila.archivado,
    created_by: fila.created_by,
    created_at: fila.created_at,
    updated_at: fila.updated_at,
```

- [ ] **Step 3: Filtrar archivados en `fetchTickets`**

La función actual:

```ts
  async function fetchTickets(): Promise<TicketPostVentaConNombres[]> {
    const { data, error } = await supabase
      .from('tickets_post_venta')
      .select('*, clientes(razon_social), productos(nombre)')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(mapearFila)
  }
```

Reemplazar por:

```ts
  async function fetchTickets(): Promise<TicketPostVentaConNombres[]> {
    const { data, error } = await supabase
      .from('tickets_post_venta')
      .select('*, clientes(razon_social), productos(nombre)')
      .eq('archivado', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(mapearFila)
  }
```

- [ ] **Step 4: Agregar `fetchTicketsPorIds` y `fetchCerrados`**

Justo después de `agregarSeguimiento`, agregar:

```ts
  async function fetchTicketsPorIds(ids: string[]): Promise<Pick<TicketPostVenta, 'id' | 'n_guia'>[]> {
    if (!ids.length) return []
    const { data, error } = await supabase.from('tickets_post_venta').select('id, n_guia').in('id', ids)
    if (error) throw error
    return data as Pick<TicketPostVenta, 'id' | 'n_guia'>[]
  }

  async function fetchCerrados(): Promise<TicketPostVentaConNombres[]> {
    const { data, error } = await supabase
      .from('tickets_post_venta')
      .select('*, clientes(razon_social), productos(nombre)')
      .eq('estado', 'despachado')
      .order('fecha_cierre', { ascending: false })

    if (error) throw error
    return (data ?? []).map(mapearFila)
  }
```

- [ ] **Step 5: Agregarlas al `return`**

El `return` actual:

```ts
  return { fetchTickets, getTicket, crearTicket, actualizarTicket, fetchSeguimientos, agregarSeguimiento }
```

Reemplazar por:

```ts
  return {
    fetchTickets,
    getTicket,
    crearTicket,
    actualizarTicket,
    fetchSeguimientos,
    agregarSeguimiento,
    fetchTicketsPorIds,
    fetchCerrados,
  }
```

- [ ] **Step 6: Reiniciar dev server**

```bash
rm -rf .nuxt && npm run dev
```

Expected: arranca sin errores.

- [ ] **Step 7: Commit**

```bash
git add app/composables/useTicketsPostVenta.ts
git commit -m "feat: filtrar archivados y agregar historial/cerrados a useTicketsPostVenta"
```

---

### Task 8: Composable `useHistorialEstados.ts`

**Files:**
- Create: `app/composables/useHistorialEstados.ts`

**Interfaces:**
- Consumes: tabla `historial_estados` (Task 1).
- Produces: `type EntidadHistorial = 'lead' | 'ticket' | 'ticket_post_venta'`, `interface HistorialEstadoRow { id, entidad_id, estado_anterior: string|null, estado_nuevo, created_at, usuario_nombre: string|null }`, `fetchHistorial(entidadTipo: EntidadHistorial): Promise<HistorialEstadoRow[]>`.

- [ ] **Step 1: Escribir el composable**

```ts
// composables/useHistorialEstados.ts
//
// Historial de cambios de estado, compartido por leads/tickets/
// tickets_post_venta (tabla genérica historial_estados). Ver spec
// 2026-07-15-historial-estados-archivado-design.md.

export type EntidadHistorial = 'lead' | 'ticket' | 'ticket_post_venta'

export interface HistorialEstadoRow {
  id: string
  entidad_id: string
  estado_anterior: string | null
  estado_nuevo: string
  created_at: string
  usuario_nombre: string | null
}

export const useHistorialEstados = () => {
  const supabase = useSupabaseClient()

  const fetchHistorial = async (entidadTipo: EntidadHistorial): Promise<HistorialEstadoRow[]> => {
    const { data, error } = await supabase
      .from('historial_estados')
      .select('id, entidad_id, estado_anterior, estado_nuevo, created_at, usuario:profiles!historial_estados_created_by_fkey(full_name)')
      .eq('entidad_tipo', entidadTipo)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map((fila: any) => ({
      id: fila.id,
      entidad_id: fila.entidad_id,
      estado_anterior: fila.estado_anterior,
      estado_nuevo: fila.estado_nuevo,
      created_at: fila.created_at,
      usuario_nombre: fila.usuario?.full_name ?? null,
    }))
  }

  return { fetchHistorial }
}
```

- [ ] **Step 2: Reiniciar dev server (gotcha #2 — composables nuevos no los recoge el hot-reload)**

```bash
rm -rf .nuxt && npm run dev
```

Expected: arranca sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useHistorialEstados.ts
git commit -m "feat: agregar useHistorialEstados"
```

---

### Task 9: Composable `useConfiguracionArchivado.ts`

**Files:**
- Create: `app/composables/useConfiguracionArchivado.ts`

**Interfaces:**
- Consumes: tabla `configuracion_archivado` (Task 3).
- Produces: `type ModuloArchivado = 'leads' | 'tickets' | 'tickets_post_venta'`, `interface ConfiguracionArchivado { modulo: ModuloArchivado; dias: number }`, `fetchConfiguracion(): Promise<ConfiguracionArchivado[]>`, `actualizarDias(modulo: ModuloArchivado, dias: number): Promise<void>`.

- [ ] **Step 1: Escribir el composable**

```ts
// composables/useConfiguracionArchivado.ts
//
// Días globales (no por usuario) antes de archivar cerrados, uno por
// módulo. Los usa el cron fn_archivar_cerrados. Ver spec
// 2026-07-15-historial-estados-archivado-design.md.

export type ModuloArchivado = 'leads' | 'tickets' | 'tickets_post_venta'

export interface ConfiguracionArchivado {
  modulo: ModuloArchivado
  dias: number
}

export const useConfiguracionArchivado = () => {
  const supabase = useSupabaseClient()

  const fetchConfiguracion = async (): Promise<ConfiguracionArchivado[]> => {
    const { data, error } = await supabase.from('configuracion_archivado').select('*')
    if (error) throw error
    return data as ConfiguracionArchivado[]
  }

  const actualizarDias = async (modulo: ModuloArchivado, dias: number): Promise<void> => {
    const { error } = await supabase.from('configuracion_archivado').update({ dias }).eq('modulo', modulo)
    if (error) throw error
  }

  return { fetchConfiguracion, actualizarDias }
}
```

- [ ] **Step 2: Reiniciar dev server**

```bash
rm -rf .nuxt && npm run dev
```

Expected: arranca sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useConfiguracionArchivado.ts
git commit -m "feat: agregar useConfiguracionArchivado"
```

---

### Task 10: Páginas `/leads/historial-movimientos` y `/leads/cerrados`

**Files:**
- Create: `app/pages/leads/historial-movimientos.vue`
- Create: `app/pages/leads/cerrados.vue`

**Interfaces:**
- Consumes: `useHistorialEstados().fetchHistorial` (Task 8), `useLeads().fetchLeadsPorIds`/`fetchCerrados` (Task 5), `colorLead` (existente en `app/utils/estadoColores.ts`).

- [ ] **Step 1: Escribir `/leads/historial-movimientos`**

```vue
<!-- app/pages/leads/historial-movimientos.vue -->
<script setup lang="ts">
import type { HistorialEstadoRow } from '~/composables/useHistorialEstados'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'leads', actions: ['view', 'view_all'] },
})

interface FilaHistorial extends HistorialEstadoRow {
  lead_nombre: string
}

const { fetchHistorial } = useHistorialEstados()
const { fetchLeadsPorIds } = useLeads()

const filas = ref<FilaHistorial[]>([])
const cargando = ref(true)

onMounted(async () => {
  const historial = await fetchHistorial('lead')
  const ids = [...new Set(historial.map((h) => h.entidad_id))]
  const leads = await fetchLeadsPorIds(ids)
  const nombrePorId = new Map(leads.map((l) => [l.id, l.nombre]))
  filas.value = historial.map((h) => ({ ...h, lead_nombre: nombrePorId.get(h.entidad_id) ?? 'Lead eliminado' }))
  cargando.value = false
})

function formatearFechaHora(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Historial de movimientos — Leads" />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="!filas.length" class="p-10 text-center text-gray-400">Sin movimientos registrados todavía.</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Lead</th>
            <th class="px-4 py-3 font-medium">De</th>
            <th class="px-4 py-3 font-medium">A</th>
            <th class="px-4 py-3 font-medium">Usuario</th>
            <th class="px-4 py-3 font-medium">Fecha</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="f in filas" :key="f.id">
            <td class="px-4 py-3 text-gray-700 font-medium">
              <NuxtLink :to="`/leads/${f.entidad_id}`" class="hover:underline">{{ f.lead_nombre }}</NuxtLink>
            </td>
            <td class="px-4 py-3">
              <SharedBadge v-if="f.estado_anterior" :label="colorLead(f.estado_anterior).label" :clases="colorLead(f.estado_anterior).clases" />
              <span v-else class="text-gray-400">—</span>
            </td>
            <td class="px-4 py-3">
              <SharedBadge :label="colorLead(f.estado_nuevo).label" :clases="colorLead(f.estado_nuevo).clases" />
            </td>
            <td class="px-4 py-3 text-gray-500">{{ f.usuario_nombre ?? '—' }}</td>
            <td class="px-4 py-3 text-gray-500">{{ formatearFechaHora(f.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Escribir `/leads/cerrados`**

```vue
<!-- app/pages/leads/cerrados.vue -->
<script setup lang="ts">
import type { Lead } from '~/composables/useLeads'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'leads', actions: ['view', 'view_all'] },
})

const { fetchCerrados } = useLeads()

const leads = ref<Lead[]>([])
const cargando = ref(true)

onMounted(async () => {
  leads.value = await fetchCerrados()
  cargando.value = false
})

function formatearFecha(fecha: string | null) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Historial de cerrados — Leads" />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="!leads.length" class="p-10 text-center text-gray-400">Sin leads cerrados todavía.</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Nombre</th>
            <th class="px-4 py-3 font-medium">Estado final</th>
            <th class="px-4 py-3 font-medium">Fecha de cierre</th>
            <th class="px-4 py-3 font-medium">Archivado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="l in leads" :key="l.id" class="cursor-pointer hover:bg-gray-50" @click="navigateTo(`/leads/${l.id}`)">
            <td class="px-4 py-3 text-gray-700 font-medium">{{ l.nombre }}</td>
            <td class="px-4 py-3"><SharedBadge :label="colorLead(l.estado).label" :clases="colorLead(l.estado).clases" /></td>
            <td class="px-4 py-3 text-gray-500">{{ formatearFecha(l.fecha_cierre) }}</td>
            <td class="px-4 py-3 text-gray-500">{{ l.archivado ? 'Sí' : 'No (aún visible en el listado activo)' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Reiniciar dev server**

```bash
rm -rf .nuxt && npm run dev
```

Expected: arranca sin errores (páginas todavía sin link de nav — se agrega en Task 14).

- [ ] **Step 4: Commit**

```bash
git add app/pages/leads/historial-movimientos.vue app/pages/leads/cerrados.vue
git commit -m "feat: agregar paginas de historial de movimientos y cerrados de leads"
```

---

### Task 11: Páginas `/tickets/historial-movimientos` y `/tickets/cerrados`

**Files:**
- Create: `app/pages/tickets/historial-movimientos.vue`
- Create: `app/pages/tickets/cerrados.vue`

**Interfaces:**
- Consumes: `useHistorialEstados().fetchHistorial` (Task 8), `useTickets().fetchTicketsPorIds`/`fetchCerrados` (Task 6), `colorTicket` (existente).

- [ ] **Step 1: Escribir `/tickets/historial-movimientos`**

```vue
<!-- app/pages/tickets/historial-movimientos.vue -->
<script setup lang="ts">
import type { HistorialEstadoRow } from '~/composables/useHistorialEstados'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets', actions: ['view', 'view_all'] },
})

interface FilaHistorial extends HistorialEstadoRow {
  ticket_titulo: string
}

const { fetchHistorial } = useHistorialEstados()
const { fetchTicketsPorIds } = useTickets()

const filas = ref<FilaHistorial[]>([])
const cargando = ref(true)

onMounted(async () => {
  const historial = await fetchHistorial('ticket')
  const ids = [...new Set(historial.map((h) => h.entidad_id))]
  const tickets = await fetchTicketsPorIds(ids)
  const tituloPorId = new Map(tickets.map((t) => [t.id, t.titulo]))
  filas.value = historial.map((h) => ({ ...h, ticket_titulo: tituloPorId.get(h.entidad_id) ?? 'Ticket eliminado' }))
  cargando.value = false
})

function formatearFechaHora(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Historial de movimientos — Tickets" />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="!filas.length" class="p-10 text-center text-gray-400">Sin movimientos registrados todavía.</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Ticket</th>
            <th class="px-4 py-3 font-medium">De</th>
            <th class="px-4 py-3 font-medium">A</th>
            <th class="px-4 py-3 font-medium">Usuario</th>
            <th class="px-4 py-3 font-medium">Fecha</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="f in filas" :key="f.id">
            <td class="px-4 py-3 text-gray-700 font-medium">
              <NuxtLink :to="`/tickets/${f.entidad_id}`" class="hover:underline">{{ f.ticket_titulo }}</NuxtLink>
            </td>
            <td class="px-4 py-3">
              <SharedBadge v-if="f.estado_anterior" :label="colorTicket(f.estado_anterior).label" :clases="colorTicket(f.estado_anterior).clases" />
              <span v-else class="text-gray-400">—</span>
            </td>
            <td class="px-4 py-3">
              <SharedBadge :label="colorTicket(f.estado_nuevo).label" :clases="colorTicket(f.estado_nuevo).clases" />
            </td>
            <td class="px-4 py-3 text-gray-500">{{ f.usuario_nombre ?? '—' }}</td>
            <td class="px-4 py-3 text-gray-500">{{ formatearFechaHora(f.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Escribir `/tickets/cerrados`**

```vue
<!-- app/pages/tickets/cerrados.vue -->
<script setup lang="ts">
import type { Ticket } from '~/composables/useTickets'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets', actions: ['view', 'view_all'] },
})

const { fetchCerrados } = useTickets()

const tickets = ref<Ticket[]>([])
const cargando = ref(true)

onMounted(async () => {
  tickets.value = await fetchCerrados()
  cargando.value = false
})

function formatearFecha(fecha: string | null) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Historial de cerrados — Tickets" />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="!tickets.length" class="p-10 text-center text-gray-400">Sin tickets cerrados todavía.</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Título</th>
            <th class="px-4 py-3 font-medium">Cliente</th>
            <th class="px-4 py-3 font-medium">Estado final</th>
            <th class="px-4 py-3 font-medium">Fecha de cierre</th>
            <th class="px-4 py-3 font-medium">Archivado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="t in tickets" :key="t.id" class="cursor-pointer hover:bg-gray-50" @click="navigateTo(`/tickets/${t.id}`)">
            <td class="px-4 py-3 text-gray-700 font-medium">{{ t.titulo }}</td>
            <td class="px-4 py-3 text-gray-500">{{ t.clientes?.razon_social ?? '—' }}</td>
            <td class="px-4 py-3"><SharedBadge :label="colorTicket(t.estado).label" :clases="colorTicket(t.estado).clases" /></td>
            <td class="px-4 py-3 text-gray-500">{{ formatearFecha(t.fecha_cierre) }}</td>
            <td class="px-4 py-3 text-gray-500">{{ t.archivado ? 'Sí' : 'No (aún visible en el listado activo)' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Reiniciar dev server**

```bash
rm -rf .nuxt && npm run dev
```

Expected: arranca sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/pages/tickets/historial-movimientos.vue app/pages/tickets/cerrados.vue
git commit -m "feat: agregar paginas de historial de movimientos y cerrados de tickets"
```

---

### Task 12: Páginas `/post-venta/historial-movimientos` y `/post-venta/cerrados`

**Files:**
- Create: `app/pages/post-venta/historial-movimientos.vue`
- Create: `app/pages/post-venta/cerrados.vue`

**Interfaces:**
- Consumes: `useHistorialEstados().fetchHistorial` (Task 8), `useTicketsPostVenta().fetchTicketsPorIds`/`fetchCerrados` (Task 7), `colorTicketPostVenta` (existente).

- [ ] **Step 1: Escribir `/post-venta/historial-movimientos`**

```vue
<!-- app/pages/post-venta/historial-movimientos.vue -->
<script setup lang="ts">
import type { HistorialEstadoRow } from '~/composables/useHistorialEstados'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets_post_venta', actions: ['view'] },
})

interface FilaHistorial extends HistorialEstadoRow {
  n_guia: string
}

const { fetchHistorial } = useHistorialEstados()
const { fetchTicketsPorIds } = useTicketsPostVenta()

const filas = ref<FilaHistorial[]>([])
const cargando = ref(true)

onMounted(async () => {
  const historial = await fetchHistorial('ticket_post_venta')
  const ids = [...new Set(historial.map((h) => h.entidad_id))]
  const tickets = await fetchTicketsPorIds(ids)
  const guiaPorId = new Map(tickets.map((t) => [t.id, t.n_guia]))
  filas.value = historial.map((h) => ({ ...h, n_guia: guiaPorId.get(h.entidad_id) ?? 'Ticket eliminado' }))
  cargando.value = false
})

function formatearFechaHora(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Historial de movimientos — Post Venta" />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="!filas.length" class="p-10 text-center text-gray-400">Sin movimientos registrados todavía.</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Guía</th>
            <th class="px-4 py-3 font-medium">De</th>
            <th class="px-4 py-3 font-medium">A</th>
            <th class="px-4 py-3 font-medium">Usuario</th>
            <th class="px-4 py-3 font-medium">Fecha</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="f in filas" :key="f.id">
            <td class="px-4 py-3 text-gray-700 font-medium">
              <NuxtLink :to="`/post-venta/${f.entidad_id}`" class="hover:underline">{{ f.n_guia }}</NuxtLink>
            </td>
            <td class="px-4 py-3">
              <SharedBadge v-if="f.estado_anterior" :label="colorTicketPostVenta(f.estado_anterior).label" :clases="colorTicketPostVenta(f.estado_anterior).clases" />
              <span v-else class="text-gray-400">—</span>
            </td>
            <td class="px-4 py-3">
              <SharedBadge :label="colorTicketPostVenta(f.estado_nuevo).label" :clases="colorTicketPostVenta(f.estado_nuevo).clases" />
            </td>
            <td class="px-4 py-3 text-gray-500">{{ f.usuario_nombre ?? '—' }}</td>
            <td class="px-4 py-3 text-gray-500">{{ formatearFechaHora(f.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Escribir `/post-venta/cerrados`**

```vue
<!-- app/pages/post-venta/cerrados.vue -->
<script setup lang="ts">
import type { TicketPostVentaConNombres } from '~/composables/useTicketsPostVenta'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets_post_venta', actions: ['view'] },
})

const { fetchCerrados } = useTicketsPostVenta()

const tickets = ref<TicketPostVentaConNombres[]>([])
const cargando = ref(true)

onMounted(async () => {
  tickets.value = await fetchCerrados()
  cargando.value = false
})

function formatearFecha(fecha: string | null) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Historial de cerrados — Post Venta" />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="!tickets.length" class="p-10 text-center text-gray-400">Sin tickets despachados todavía.</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Guía</th>
            <th class="px-4 py-3 font-medium">Cliente</th>
            <th class="px-4 py-3 font-medium">Equipo</th>
            <th class="px-4 py-3 font-medium">Fecha despacho</th>
            <th class="px-4 py-3 font-medium">Fecha de cierre</th>
            <th class="px-4 py-3 font-medium">Archivado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="t in tickets" :key="t.id" class="cursor-pointer hover:bg-gray-50" @click="navigateTo(`/post-venta/${t.id}`)">
            <td class="px-4 py-3 text-gray-700 font-medium">{{ t.n_guia }}</td>
            <td class="px-4 py-3 text-gray-500">{{ t.cliente_nombre }}</td>
            <td class="px-4 py-3 text-gray-500">{{ t.producto_nombre }}</td>
            <td class="px-4 py-3 text-gray-500">{{ formatearFecha(t.fecha_despacho) }}</td>
            <td class="px-4 py-3 text-gray-500">{{ formatearFecha(t.fecha_cierre) }}</td>
            <td class="px-4 py-3 text-gray-500">{{ t.archivado ? 'Sí' : 'No (aún visible en el listado activo)' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Reiniciar dev server**

```bash
rm -rf .nuxt && npm run dev
```

Expected: arranca sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/pages/post-venta/historial-movimientos.vue app/pages/post-venta/cerrados.vue
git commit -m "feat: agregar paginas de historial de movimientos y cerrados de post venta"
```

---

### Task 13: `ConfiguracionModal.vue` — días de archivado (gateado a `post_venta`)

**Files:**
- Modify: `app/components/shared/ConfiguracionModal.vue`

**Interfaces:**
- Consumes: `useConfiguracionArchivado()` (Task 9), `perfil.value.roles` (ya expuesto por `useMiPerfil`).

- [ ] **Step 1: Agregar el estado y la carga de configuración**

El script actual:

```ts
<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ cerrar: [] }>()

const { perfil, actualizarConfiguracion } = useMiPerfil()
const { success, error } = useToast()

const umbralMinutos = ref(30)
const guardando = ref(false)

watch(
  () => props.open,
  (abierto) => {
    if (!abierto) return
    const valor = perfil.value?.settings?.umbral_alertas_minutos
    umbralMinutos.value = typeof valor === 'number' ? valor : 30
  }
)

async function onGuardar() {
  if (umbralMinutos.value < 1) return
  guardando.value = true
  try {
    await actualizarConfiguracion({ umbral_alertas_minutos: umbralMinutos.value })
    success('Configuración guardada')
    emit('cerrar')
  } catch (e) {
    error('No se pudo guardar la configuración')
  } finally {
    guardando.value = false
  }
}
</script>
```

Reemplazar por:

```ts
<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ cerrar: [] }>()

const { perfil, actualizarConfiguracion } = useMiPerfil()
const { fetchConfiguracion, actualizarDias } = useConfiguracionArchivado()
const { success, error } = useToast()

const umbralMinutos = ref(30)
const guardando = ref(false)

const mostrarArchivado = computed(() => perfil.value?.roles.includes('post_venta') ?? false)
const diasLeads = ref(30)
const diasTickets = ref(30)
const diasPostVenta = ref(30)

watch(
  () => props.open,
  async (abierto) => {
    if (!abierto) return
    const valor = perfil.value?.settings?.umbral_alertas_minutos
    umbralMinutos.value = typeof valor === 'number' ? valor : 30

    if (mostrarArchivado.value) {
      const config = await fetchConfiguracion()
      diasLeads.value = config.find((c) => c.modulo === 'leads')?.dias ?? 30
      diasTickets.value = config.find((c) => c.modulo === 'tickets')?.dias ?? 30
      diasPostVenta.value = config.find((c) => c.modulo === 'tickets_post_venta')?.dias ?? 30
    }
  }
)

async function onGuardar() {
  if (umbralMinutos.value < 1) return
  if (mostrarArchivado.value && (diasLeads.value < 1 || diasTickets.value < 1 || diasPostVenta.value < 1)) return

  guardando.value = true
  try {
    await actualizarConfiguracion({ umbral_alertas_minutos: umbralMinutos.value })
    if (mostrarArchivado.value) {
      await Promise.all([
        actualizarDias('leads', diasLeads.value),
        actualizarDias('tickets', diasTickets.value),
        actualizarDias('tickets_post_venta', diasPostVenta.value),
      ])
    }
    success('Configuración guardada')
    emit('cerrar')
  } catch (e) {
    error('No se pudo guardar la configuración')
  } finally {
    guardando.value = false
  }
}
</script>
```

- [ ] **Step 2: Agregar los campos al template**

El bloque del template actual:

```vue
<template>
  <SharedModal :open="open" titulo="Configuración" @cerrar="$emit('cerrar')">
    <div>
      <label class="block text-xs font-medium text-ink-muted mb-1">
        Avisar tareas próximas a vencer con cuántos minutos de anticipación
      </label>
      <input
        v-model.number="umbralMinutos"
        type="number"
        min="1"
        class="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
      />
    </div>

    <div class="flex justify-end mt-6">
```

Reemplazar por:

```vue
<template>
  <SharedModal :open="open" titulo="Configuración" @cerrar="$emit('cerrar')">
    <div>
      <label class="block text-xs font-medium text-ink-muted mb-1">
        Avisar tareas próximas a vencer con cuántos minutos de anticipación
      </label>
      <input
        v-model.number="umbralMinutos"
        type="number"
        min="1"
        class="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
      />
    </div>

    <div v-if="mostrarArchivado" class="mt-4 pt-4 border-t border-border space-y-3">
      <p class="text-xs font-medium text-ink-muted">Archivar cerrados automáticamente después de (días)</p>
      <div>
        <label class="block text-xs text-ink-muted mb-1">Leads</label>
        <input
          v-model.number="diasLeads"
          type="number"
          min="1"
          class="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        />
      </div>
      <div>
        <label class="block text-xs text-ink-muted mb-1">Tickets</label>
        <input
          v-model.number="diasTickets"
          type="number"
          min="1"
          class="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        />
      </div>
      <div>
        <label class="block text-xs text-ink-muted mb-1">Post venta</label>
        <input
          v-model.number="diasPostVenta"
          type="number"
          min="1"
          class="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        />
      </div>
    </div>

    <div class="flex justify-end mt-6">
```

- [ ] **Step 3: Reiniciar dev server**

```bash
rm -rf .nuxt && npm run dev
```

Expected: arranca sin errores.

- [ ] **Step 4: Probar en el navegador**

1. Con una cuenta **sin** rol `post_venta`: abrir el menú de usuario → Configuración. Solo se ve el campo de umbral de alertas.
2. Con `n.quevedo@integrakin.cl` (rol `post_venta`): abrir Configuración. Se ven los 3 campos de días, precargados con el valor de `configuracion_archivado`. Cambiar "Tickets" a 15 y guardar.
3. Volver a abrir Configuración: "Tickets" sigue en 15 (persistió).

Expected: los 3 pasos funcionan sin errores en consola.

- [ ] **Step 5: Commit**

```bash
git add app/components/shared/ConfiguracionModal.vue
git commit -m "feat: agregar dias de archivado al modal de configuracion"
```

---

### Task 14: Reestructura del nav (`app/layouts/default.vue`)

**Files:**
- Modify: `app/layouts/default.vue`

**Interfaces:** ninguna — solo navegación.

- [ ] **Step 1: Reemplazar `navCrm` y agregar el helper `esActivoListado`**

El bloque actual:

```ts
const esActivo = (path: string) => route.path === path || route.path.startsWith(path + '/')

const navCrm = [
  { path: '/clientes', label: 'Clientes', permiso: ['view', 'view_all'] as const, resource: 'clientes' },
  { path: '/leads', label: 'Leads', permiso: ['view', 'view_all'] as const, resource: 'leads' },
  { path: '/tickets', label: 'Tickets', permiso: ['view', 'view_all'] as const, resource: 'tickets' },
  { path: '/productos', label: 'Productos', permiso: ['view', 'view_all'] as const, resource: 'productos' },
  { path: '/post-venta', label: 'Post Venta', permiso: ['view', 'view'] as const, resource: 'tickets_post_venta' },
]
```

Reemplazar por:

```ts
const esActivo = (path: string) => route.path === path || route.path.startsWith(path + '/')

// para los links "Listado" de Leads/Tickets/Post Venta: igual que esActivo
// (para que /leads/[id] siga marcando "Listado" como activo), pero
// excluyendo explícitamente las rutas hermanas de historial/cerrados que
// también empiezan con el mismo prefijo.
const esActivoListado = (path: string) =>
  route.path === path ||
  (route.path.startsWith(path + '/') &&
    !route.path.startsWith(`${path}/historial-movimientos`) &&
    !route.path.startsWith(`${path}/cerrados`))

const navCrm = [
  { path: '/clientes', label: 'Clientes', permiso: ['view', 'view_all'] as const, resource: 'clientes' },
  { path: '/productos', label: 'Productos', permiso: ['view', 'view_all'] as const, resource: 'productos' },
]
```

- [ ] **Step 2: Agregar las 3 secciones nuevas al template**

El bloque actual (sección CRM, seguida directamente de Capacitaciones):

```vue
        <div>
          <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">CRM</p>
          <div class="space-y-0.5">
            <SharedNavLink
              v-for="item in navCrm"
              v-show="can(item.resource, item.permiso[0]) || can(item.resource, item.permiso[1])"
              :key="item.path"
              :to="item.path"
              :activo="esActivo(item.path)"
            >
              {{ item.label }}
            </SharedNavLink>
          </div>
        </div>

        <div v-if="can('capacitaciones', 'view') || can('capacitaciones', 'view_all')">
```

Reemplazar por:

```vue
        <div>
          <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">CRM</p>
          <div class="space-y-0.5">
            <SharedNavLink
              v-for="item in navCrm"
              v-show="can(item.resource, item.permiso[0]) || can(item.resource, item.permiso[1])"
              :key="item.path"
              :to="item.path"
              :activo="esActivo(item.path)"
            >
              {{ item.label }}
            </SharedNavLink>
          </div>
        </div>

        <div v-if="can('leads', 'view') || can('leads', 'view_all')">
          <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Leads</p>
          <div class="space-y-0.5">
            <SharedNavLink to="/leads" :activo="esActivoListado('/leads')">Listado</SharedNavLink>
            <SharedNavLink to="/leads/historial-movimientos" :activo="esActivo('/leads/historial-movimientos')">
              Historial de movimientos
            </SharedNavLink>
            <SharedNavLink to="/leads/cerrados" :activo="esActivo('/leads/cerrados')">Historial de cerrados</SharedNavLink>
          </div>
        </div>

        <div v-if="can('tickets', 'view') || can('tickets', 'view_all')">
          <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Servicio Técnico</p>
          <div class="space-y-0.5">
            <SharedNavLink to="/tickets" :activo="esActivoListado('/tickets')">Tickets</SharedNavLink>
            <SharedNavLink to="/tickets/historial-movimientos" :activo="esActivo('/tickets/historial-movimientos')">
              Historial de movimientos
            </SharedNavLink>
            <SharedNavLink to="/tickets/cerrados" :activo="esActivo('/tickets/cerrados')">Historial de cerrados</SharedNavLink>
          </div>
        </div>

        <div v-if="can('tickets_post_venta', 'view')">
          <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Post Venta</p>
          <div class="space-y-0.5">
            <SharedNavLink to="/post-venta" :activo="esActivoListado('/post-venta')">Tickets</SharedNavLink>
            <SharedNavLink to="/post-venta/historial-movimientos" :activo="esActivo('/post-venta/historial-movimientos')">
              Historial de movimientos
            </SharedNavLink>
            <SharedNavLink to="/post-venta/cerrados" :activo="esActivo('/post-venta/cerrados')">Historial de cerrados</SharedNavLink>
          </div>
        </div>

        <div v-if="can('capacitaciones', 'view') || can('capacitaciones', 'view_all')">
```

- [ ] **Step 3: Reiniciar dev server y probar en el navegador**

```bash
rm -rf .nuxt && npm run dev
```

1. Login con una cuenta con `leads.view_all`, `tickets.view_all` y rol `post_venta`: confirmar que aparecen las secciones "CRM" (Clientes, Productos), "Leads" (3 links), "Servicio Técnico" (3 links), "Post Venta" (3 links).
2. Entrar a `/leads`: el link "Listado" de la sección Leads queda resaltado.
3. Entrar a `/leads/historial-movimientos`: ese link queda resaltado y "Listado" **no**.
4. Entrar a un lead puntual `/leads/[id]`: "Listado" vuelve a quedar resaltado.
5. Repetir 2-4 para `/tickets` y `/post-venta`.

Expected: los 5 pasos funcionan sin errores en consola, sin doble resaltado simultáneo.

- [ ] **Step 4: Commit**

```bash
git add app/layouts/default.vue
git commit -m "feat: reestructurar nav en secciones Leads, Servicio Tecnico y Post Venta"
```

---

### Task 15: Actualizar `CONTEXTO_PROYECTO.md`

**Files:**
- Modify: `CONTEXTO_PROYECTO.md`

**Interfaces:** ninguna — solo documentación.

- [ ] **Step 1: Agregar las migraciones nuevas**

En la sección `### Migraciones SQL`, agregar al final del bloque (después de `20260714220000_notificacion_tickets_post_venta_vencidos.sql`):

```
20260715000000_historial_estados.sql
20260715010000_cierre_archivado.sql
20260715020000_configuracion_archivado.sql
20260715030000_cron_archivar_cerrados.sql
```

- [ ] **Step 2: Agregar las páginas nuevas**

En `### Páginas`, después de `post-venta/[id].vue`, agregar:

```
leads/historial-movimientos.vue    — todos los cambios de estado de leads
leads/cerrados.vue                 — leads ganados/perdidos, histórico completo
tickets/historial-movimientos.vue  — todos los cambios de estado de tickets
tickets/cerrados.vue               — tickets resueltos/cerrados, histórico completo
post-venta/historial-movimientos.vue — cambios de estado de tickets post-venta
post-venta/cerrados.vue            — tickets despachados, histórico completo
```

- [ ] **Step 3: Agregar los composables nuevos**

En `### Composables`, agregar `useConfiguracionArchivado` y `useHistorialEstados` a la lista alfabética (entre `useClienteInteracciones`/`useClientes` y `useCsv` para el primero, y entre `useFeatures` y `useLeadInteracciones` para el segundo — orden alfabético real).

- [ ] **Step 4: Agregar entrada al Roadmap**

Al final de la sección `## Roadmap — estado actual` (después del punto 29, Tickets de post-venta), agregar:

```
30. ✅ **Historial de estados y archivado automático** — tabla genérica
    `historial_estados` (patrón `entidad_tipo`/`entidad_id`) con trigger
    en `leads`/`tickets`/`tickets_post_venta`; columnas `fecha_cierre`/
    `archivado` gestionadas por trigger de cierre propio de cada tabla;
    cron diario `fn_archivar_cerrados` que archiva (nunca borra) usando
    días configurables por módulo en `configuracion_archivado` (valor
    global, no por usuario). 6 páginas nuevas (historial de movimientos +
    historial de cerrados, por módulo) y reestructura del nav (Leads/
    Servicio Técnico/Post Venta como secciones propias). Días editables
    desde el modal de Configuración, visible solo para cuentas con rol
    `post_venta` (ver spec
    `2026-07-15-historial-estados-archivado-design.md`).
```

Actualizar la fecha de "Última actualización" al tope del documento a la fecha en que se ejecute esta tarea.

- [ ] **Step 5: Commit**

```bash
git add CONTEXTO_PROYECTO.md
git commit -m "docs: actualizar contexto con historial de estados y archivado automatico"
```

---

## Self-Review Notes

- **Cobertura de la spec:** tabla `historial_estados` + trigger (Task 1),
  columnas `fecha_cierre`/`archivado` + trigger de cierre (Task 2),
  `configuracion_archivado` + permiso (Task 3), cron de archivado (Task 4),
  filtro de listados activos + `fetchCerrados`/`fetchTicketsPorIds` en los
  3 composables (Tasks 5-7), `useHistorialEstados` (Task 8),
  `useConfiguracionArchivado` (Task 9), 6 páginas (Tasks 10-12), modal de
  Configuración gateado a `post_venta` (Task 13), reestructura de nav
  (Task 14), doc (Task 15). Las alternativas descartadas de la spec (tabla
  por módulo, días por usuario, hard delete, cerrados-solo-archivados) no
  generan tareas a propósito.
- **Placeholders:** ninguno — cada paso tiene código completo o comando
  exacto.
- **Consistencia de tipos:** `HistorialEstadoRow`/`EntidadHistorial`
  (Task 8) se usan sin cambios en Tasks 10-12; `ConfiguracionArchivado`/
  `ModuloArchivado` (Task 9) se usan sin cambios en Task 13;
  `fetchLeadsPorIds`/`fetchTicketsPorIds` (×2, en `useTickets` y
  `useTicketsPostVenta`) y `fetchCerrados` (×3) siguen la misma firma en
  cada composable y se consumen igual en sus páginas correspondientes;
  `esActivoListado` (Task 14) se define una sola vez y se usa en los 3
  links "Listado" nuevos.
