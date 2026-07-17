-- fetchUsuariosPorRol() (useUsuarios.ts) hacía el filtro por rol en el
-- cliente: traía profiles + profile_roles(role:roles(...)) y filtraba
-- por nombre de rol en JS. profile_roles tiene RLS
-- (20260714000000_multi_rol_usuarios.sql) que solo deja ver los roles
-- de OTROS usuarios a quien tenga dashboard_widgets.assign (admin) -
-- para cualquier otro usuario autenticado, el join devolvía `roles: []`
-- en silencio para las filas ajenas (no error), así que el filtro
-- client-side las descartaba. Un usuario sin ese permiso administrativo
-- (ej. Natalia, líder de vendedoras pero no dueña) solo se veía a sí
-- misma en selectores como "vendedor" en /leads o "responsable" en
-- capacitaciones, aunque hubiera más gente con ese rol.
--
-- Se resuelve con una RPC security definer (mismo patrón que
-- permisos_efectivos_usuario) que hace el filtro por rol en el
-- servidor, sin pasar por la RLS de profile_roles.

create or replace function usuarios_por_rol(p_rol text)
returns table (id uuid, full_name text, email text)
language sql
security definer
stable
as $$
  select p.id, p.full_name, p.email
  from profiles p
  join profile_roles pr on pr.profile_id = p.id
  join roles r on r.id = pr.role_id
  where r.name = p_rol and p.active = true
  order by p.full_name;
$$;
