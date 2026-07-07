-- Seed de roles + permisos, matriz completa incluyendo tickets
-- (en el seed del módulo Clientes/Leads faltaba la columna tickets, se agrega acá)

insert into roles (name, description) values
  ('dueña', 'Acceso total, dueña del negocio'),
  ('finanzas', 'Visibilidad financiera, sin edición de pipeline comercial'),
  ('post_venta', 'Seguimiento post-venta de clientes'),
  ('ventas', 'Gestión de leads y clientes propios'),
  ('marketing', 'Generación de leads, sin gestión comercial'),
  ('servicio_tecnico', 'Gestión de tickets técnicos'),
  ('logistica', 'Visibilidad de clientes para despacho'),
  ('operaciones', 'Visibilidad transversal de operación'),
  ('capacitaciones', 'Sin acceso a clientes/leads/tickets en el MVP')
on conflict (name) do nothing;

insert into permissions (resource, action) values
  ('clientes', 'view'), ('clientes', 'view_all'), ('clientes', 'create'),
  ('clientes', 'edit'), ('clientes', 'delete'),
  ('leads', 'view'), ('leads', 'view_all'), ('leads', 'create'),
  ('leads', 'edit'), ('leads', 'delete'), ('leads', 'assign'),
  ('tickets', 'view'), ('tickets', 'view_all'), ('tickets', 'create'),
  ('tickets', 'edit'), ('tickets', 'delete'), ('tickets', 'assign')
on conflict (resource, action) do nothing;

do $$
declare
  r_id uuid;
  p_id uuid;
  matriz jsonb := '{
    "dueña":            ["clientes.view_all","clientes.create","clientes.edit","clientes.delete",
                          "leads.view_all","leads.create","leads.edit","leads.delete","leads.assign",
                          "tickets.view_all","tickets.create","tickets.edit","tickets.delete","tickets.assign"],
    "ventas":           ["clientes.view","clientes.create","clientes.edit",
                          "leads.view","leads.create","leads.edit","leads.assign",
                          "tickets.view"],
    "marketing":        ["clientes.view_all","leads.view_all","leads.create"],
    "post_venta":       ["clientes.view_all","leads.view_all",
                          "tickets.view","tickets.create","tickets.edit"],
    "servicio_tecnico": ["clientes.view_all",
                          "tickets.view","tickets.create","tickets.edit"],
    "finanzas":         ["clientes.view_all","tickets.view_all"],
    "logistica":        ["clientes.view_all","tickets.view"],
    "operaciones":      ["clientes.view_all","leads.view_all","tickets.view_all"],
    "capacitaciones":   []
  }';
  rol text;
  perm text;
begin
  for rol in select jsonb_object_keys(matriz) loop
    select id into r_id from roles where name = rol;
    for perm in select jsonb_array_elements_text(matriz->rol) loop
      select id into p_id from permissions
        where resource = split_part(perm, '.', 1) and action = split_part(perm, '.', 2);
      if p_id is not null then
        insert into role_permissions (role_id, permission_id)
        values (r_id, p_id)
        on conflict do nothing;
      end if;
    end loop;
  end loop;
end $$;
