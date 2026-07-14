-- supabase/migrations/20260714000000_multi_rol_usuarios.sql
--
-- Multi-rol de usuarios: profiles.role_id (uno a uno) -> profile_roles
-- (muchos a muchos). Ver docs/superpowers/specs/2026-07-14-multi-rol-usuarios-design.md

create table profile_roles (
  profile_id uuid not null references profiles(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, role_id)
);

create index idx_profile_roles_role on profile_roles(role_id);

alter table profile_roles enable row level security;

-- Migrar datos existentes antes de tocar has_permission/permisos_efectivos_usuario.
insert into profile_roles (profile_id, role_id)
select id, role_id from profiles where role_id is not null;

-- Resolución de permisos: unión de permisos de TODOS los roles asignados.
create or replace function has_permission(p_user uuid, p_resource text, p_action text)
returns boolean
language plpgsql
stable
security definer
as $$
declare
  v_override text;
  v_role_has boolean;
begin
  if exists (select 1 from superadmins where user_id = p_user) then
    return true;
  end if;

  select upo.effect into v_override
  from user_permission_overrides upo
  join permissions p on p.id = upo.permission_id
  where upo.user_id = p_user and p.resource = p_resource and p.action = p_action;

  if v_override = 'revoke' then
    return false;
  elsif v_override = 'grant' then
    return true;
  end if;

  select exists (
    select 1
    from profile_roles pfr
    join role_permissions rp on rp.role_id = pfr.role_id
    join permissions p on p.id = rp.permission_id
    where pfr.profile_id = p_user and p.resource = p_resource and p.action = p_action
  ) into v_role_has;

  return coalesce(v_role_has, false);
end;
$$;

create or replace function permisos_efectivos_usuario(p_user uuid)
returns table(resource text, action text)
language sql
stable
security definer
as $$
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
$$;

-- Fix de bug preexistente: roles tenía RLS activo sin ninguna política de
-- SELECT, así que cualquier join a roles desde el cliente devolvía null
-- silenciosamente en vez de error (ver spec, sección RLS).
create policy roles_select on roles
for select using (auth.role() = 'authenticated');

create policy profile_roles_select on profile_roles
for select using (
  profile_id = auth.uid()
  or has_permission(auth.uid(), 'dashboard_widgets', 'assign')
);

create policy profile_roles_write on profile_roles
for all using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));

-- El trigger ya no protege role_id (la columna se elimina más abajo), solo active.
create or replace function proteger_cambio_rol()
returns trigger
language plpgsql
security definer
as $$
begin
  if (new.active is distinct from old.active) and auth.uid() is not null then
    raise exception 'Solo un administrador puede cambiar el estado activo de un usuario';
  end if;
  return new;
end;
$$;

alter table profiles drop column role_id;
