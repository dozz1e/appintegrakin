-- supabase/migrations/20260719030000_fix_permisos_usuarios_rpc.sql

create or replace function public.permisos_efectivos_usuario(p_user uuid)
 returns table(resource text, action text)
 language plpgsql
 stable security definer
as $function$
BEGIN
  p_user := auth.uid();

  IF EXISTS (SELECT 1 FROM superadmins WHERE user_id = p_user) THEN
    RETURN QUERY SELECT p.resource, p.action FROM permissions p;
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT p.resource, p.action
    FROM profile_roles pfr
    JOIN role_permissions rp ON rp.role_id = pfr.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE pfr.profile_id = p_user
  ),
  overrides_grant AS (
    SELECT p.resource, p.action
    FROM user_permission_overrides upo
    JOIN permissions p ON p.id = upo.permission_id
    WHERE upo.user_id = p_user AND upo.effect = 'grant'
  ),
  overrides_revoke AS (
    SELECT p.resource, p.action
    FROM user_permission_overrides upo
    JOIN permissions p ON p.id = upo.permission_id
    WHERE upo.user_id = p_user AND upo.effect = 'revoke'
  )
  SELECT base.resource, base.action FROM base
  UNION
  SELECT overrides_grant.resource, overrides_grant.action FROM overrides_grant
  EXCEPT
  SELECT overrides_revoke.resource, overrides_revoke.action FROM overrides_revoke;
END;
$function$;

create or replace function public.usuarios_por_rol(p_rol text)
 returns table(id uuid, full_name text, email text)
 language sql
 stable security definer
as $function$
  select p.id, p.full_name, p.email
  from profiles p
  join profile_roles pr on pr.profile_id = p.id
  join roles r on r.id = pr.role_id
  where r.name = p_rol and p.active = true and auth.uid() is not null
  order by p.full_name;
$function$;
