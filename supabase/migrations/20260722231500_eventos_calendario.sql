-- 20260722231500_eventos_calendario.sql
--
-- Calendario de oficina compartido, pedido explícito: "todos pueden verlo"
-- y todos pueden crear/editar - sin categorías, sin gating por
-- resource/permiso como el resto de los módulos. Cualquier usuario
-- autenticado ve, crea, edita y borra cualquier evento.

create table eventos_calendario (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  fecha_hora timestamptz not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_eventos_calendario_fecha on eventos_calendario(fecha_hora);

alter table eventos_calendario enable row level security;

create policy select_eventos_calendario on eventos_calendario
for select using (auth.uid() is not null);

create policy insert_eventos_calendario on eventos_calendario
for insert with check (auth.uid() is not null and created_by = auth.uid());

create policy update_eventos_calendario on eventos_calendario
for update using (auth.uid() is not null);

create policy delete_eventos_calendario on eventos_calendario
for delete using (auth.uid() is not null);
