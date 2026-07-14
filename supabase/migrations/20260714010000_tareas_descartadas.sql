-- Descarte de alerts de tarea próxima/vencida (RecordatorioAlert), por
-- usuario. Reemplaza el localStorage anterior (commit 03d34c6): ese
-- enfoque no persiste entre navegadores/dispositivos ni en incógnito,
-- que arranca siempre con storage vacío.

create table tareas_descartadas (
  user_id uuid not null references profiles(id),
  tarea_id uuid not null references tareas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tarea_id)
);

alter table tareas_descartadas enable row level security;

create policy select_tareas_descartadas on tareas_descartadas
for select using (user_id = auth.uid());

create policy insert_tareas_descartadas on tareas_descartadas
for insert with check (user_id = auth.uid());

create policy delete_tareas_descartadas on tareas_descartadas
for delete using (user_id = auth.uid());
