insert into permissions (resource, action) values
  ('productos', 'view'), ('productos', 'view_all'), ('productos', 'create'),
  ('productos', 'edit'), ('productos', 'delete')
on conflict (resource, action) do nothing;

do $$
declare
  r_id uuid;
  p_id uuid;
  perm text;
begin
  select id into r_id from roles where name = 'dueña';
  for perm in select unnest(array[
    'productos.view_all','productos.create','productos.edit','productos.delete'
  ]) loop
    select id into p_id from permissions
      where resource = split_part(perm, '.', 1) and action = split_part(perm, '.', 2);
    if p_id is not null then
      insert into role_permissions (role_id, permission_id)
      values (r_id, p_id)
      on conflict do nothing;
    end if;
  end loop;
end $$;
