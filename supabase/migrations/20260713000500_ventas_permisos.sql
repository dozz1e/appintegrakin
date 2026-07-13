insert into permissions (resource, action) values
  ('ventas', 'view'), ('ventas', 'view_all'), ('ventas', 'create'),
  ('ventas', 'edit'), ('ventas', 'delete')
on conflict (resource, action) do nothing;

do $$
declare
  r_id uuid;
  p_id uuid;
  matriz jsonb := '{
    "dueña":      ["ventas.view_all","ventas.create","ventas.edit","ventas.delete"],
    "ventas":     ["ventas.view","ventas.create","ventas.edit"],
    "post_venta": ["ventas.view","ventas.create","ventas.edit"],
    "finanzas":   ["ventas.view_all"],
    "logistica":  ["ventas.view"],
    "operaciones":["ventas.view_all"]
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
