-- permisos_efectivos_usuario() nunca tuvo bypass de superadmin (a diferencia
-- de has_permission(), que sí lo tiene desde 20260703000000). Se disimulaba
-- mientras el superadmin también tuviera un rol de negocio con todos los
-- permisos (ej. "dueña"); al quitarle el rol y dejarlo solo como superadmin,
-- la función devuelve cero filas y el frontend (usePermissions -> nav) no
-- muestra nada.

create or replace function permisos_efectivos_usuario(p_user uuid)
returns table(resource text, action text)
language plpgsql
stable
security definer
as $$
begin
  if exists (select 1 from superadmins where user_id = p_user) then
    return query select p.resource, p.action from permissions p;
    return;
  end if;

  return query
  with base as (
    select p.resource, p.action
    from profile_roles pfr
    join role_permissions rp on rp.role_id = pfr.role_id
    join permissions p on p.id = rp.permission_id
    where pfr.profile_id = p_user
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
end;
$$;
