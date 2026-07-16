-- Descarte independiente por umbral (antes era por tarea/cita entera):
-- el "tier" es el umbral vigente al momento de descartar (0 = vencida).
-- Ver docs/superpowers/specs/2026-07-16-multiples-umbrales-alertas-design.md

alter table tareas_descartadas add column umbral_minutos integer not null default 0;
alter table tareas_descartadas drop constraint tareas_descartadas_pkey;
alter table tareas_descartadas add primary key (user_id, tarea_id, umbral_minutos);

alter table citas_descartadas add column umbral_minutos integer not null default 0;
alter table citas_descartadas drop constraint citas_descartadas_pkey;
alter table citas_descartadas add primary key (user_id, cita_id, umbral_minutos);
