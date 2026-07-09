-- Tareas y recordatorios genéricos (lead/cliente/ticket).
-- Migración retroactiva: la tabla ya existía en la base real (creada a mano
-- en el SQL Editor de Supabase); este archivo documenta y versiona ese
-- esquema tal como está desplegado hoy.

create table tareas (
  id uuid primary key default gen_random_uuid(),
  entidad_tipo text check (entidad_tipo in ('lead','cliente','ticket')) not null,
  entidad_id uuid not null,
  titulo text not null,
  fecha_vencimiento timestamptz,
  completada boolean not null default false,
  owner_id uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tareas_entidad on tareas(entidad_tipo, entidad_id);
create index idx_tareas_owner on tareas(owner_id) where not completada;

alter table tareas enable row level security;

create policy select_tareas on tareas
for select using (
  owner_id = auth.uid()
  or has_permission(auth.uid(), 'tareas', 'view_all')
);

create policy insert_tareas on tareas
for insert with check (
  created_by = auth.uid()
  and (owner_id = auth.uid() or has_permission(auth.uid(), 'tareas', 'assign'))
);

create policy update_tareas on tareas
for update using (
  owner_id = auth.uid()
  or has_permission(auth.uid(), 'tareas', 'view_all')
);
