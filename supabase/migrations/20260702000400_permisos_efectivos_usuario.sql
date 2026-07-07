-- Devuelve resource+action de todos los permisos que el usuario tiene activos,
-- ya resolviendo overrides sobre rol. El frontend la llama una vez al iniciar sesión
-- (ver composables/usePermissions.ts) y cachea el resultado.

create or replace function permisos_efectivos_usuario(p_user uuid)
returns table (resource text, action text)
language sql
security definer
stable
as $$
  with base as (
    select p.resource, p.action
    from profiles pr
    join role_permissions rp on rp.role_id = pr.role_id
    join permissions p on p.id = rp.permission_id
    where pr.id = p_user
  ),
  overrides_grant as (
    select p.resource, p.action
    from user_permission_overrides upo
    join permissions p on p.id = upo.permission_id
    where upo.user_id = p_user and upo.effect = 'grant'
  ),
  overrides_revoke as (
    select p.resource, p.action
    from user_permission_overrides upo
    join permissions p on p.id = upo.permission_id
    where upo.user_id = p_user and upo.effect = 'revoke'
  )
  select resource, action from base
  union
  select resource, action from overrides_grant
  except
  select resource, action from overrides_revoke;
$$;
