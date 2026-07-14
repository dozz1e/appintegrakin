-- Técnicos de servicio (Juan Dubó, Carlos Villanueva) no usan el CRM: no
-- tienen cuenta de auth ni profile. Se agrega una tabla propia, desacoplada
-- de profiles/auth.users, solo para poder asignarlos a tickets. owner_id en
-- tickets sigue existiendo para el patrón "propio" de RLS (has_permission +
-- auth.uid()), sin cambios; tecnico_id es un campo aparte, de solo
-- asignación/etiqueta.

create table tecnicos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table tickets add column tecnico_id uuid references tecnicos(id);
create index idx_tickets_tecnico on tickets(tecnico_id);

alter table tecnicos enable row level security;

-- Mismo criterio que la propia tabla tickets: quien puede ver tickets
-- puede ver la lista de técnicos disponibles para asignar.
create policy tecnicos_select on tecnicos
for select using (
  has_permission(auth.uid(), 'tickets', 'view_all')
  or has_permission(auth.uid(), 'tickets', 'view')
);

insert into tecnicos (nombre) values
  ('Juan Dubó'),
  ('Carlos Villanueva');
