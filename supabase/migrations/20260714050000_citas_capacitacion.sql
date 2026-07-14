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
