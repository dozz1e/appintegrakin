-- supabase/migrations/20260715020000_configuracion_archivado.sql
--
-- Valor global (no por usuario) de días antes de archivar cerrados, uno
-- por módulo. Lo usa el cron fn_archivar_cerrados. Editable solo por
-- cuentas con rol post_venta o dueña, desde el modal de Configuración
-- (ver Task 13). Ver spec 2026-07-15-historial-estados-archivado-design.md.

create table configuracion_archivado (
  modulo text primary key check (modulo in ('leads', 'tickets', 'tickets_post_venta')),
  dias integer not null check (dias > 0)
);

insert into configuracion_archivado (modulo, dias) values
  ('leads', 30), ('tickets', 30), ('tickets_post_venta', 30);

alter table configuracion_archivado enable row level security;

create policy select_configuracion_archivado on configuracion_archivado
for select using (auth.uid() is not null);

create policy update_configuracion_archivado on configuracion_archivado
for update using (has_permission(auth.uid(), 'configuracion_archivado', 'edit'));

insert into permissions (resource, action) values
  ('configuracion_archivado', 'edit')
on conflict (resource, action) do nothing;

do $$
declare
  r_id uuid;
  p_id uuid;
  matriz jsonb := '{
    "dueña":      ["configuracion_archivado.edit"],
    "post_venta": ["configuracion_archivado.edit"]
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
