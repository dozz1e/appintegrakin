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
