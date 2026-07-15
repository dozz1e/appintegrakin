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
