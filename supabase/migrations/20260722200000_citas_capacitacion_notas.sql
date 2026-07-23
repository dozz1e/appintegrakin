-- supabase/migrations/20260722200000_citas_capacitacion_notas.sql
--
-- Bitácora de anotaciones tomadas durante/después de una capacitación -
-- mismo patrón append-only que tickets_post_venta_seguimientos (solo
-- insert + select, sin update/delete: lo anotado queda guardado).

create table citas_capacitacion_notas (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null references citas_capacitacion(id) on delete cascade,
  nota text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_citas_capacitacion_notas_cita on citas_capacitacion_notas(cita_id, created_at desc);

alter table citas_capacitacion_notas enable row level security;

-- Visibilidad heredada de citas_capacitacion (mismo patrón que
-- select_interacciones_si_ve_cliente).
create policy select_citas_capacitacion_notas on citas_capacitacion_notas
for select using (
  exists (select 1 from citas_capacitacion c where c.id = citas_capacitacion_notas.cita_id)
);

create policy insert_citas_capacitacion_notas on citas_capacitacion_notas
for insert with check (
  created_by = auth.uid()
  and exists (
    select 1 from citas_capacitacion c
    where c.id = citas_capacitacion_notas.cita_id
      and (c.owner_id = auth.uid() or has_permission(auth.uid(), 'capacitaciones', 'view_all'))
  )
);
