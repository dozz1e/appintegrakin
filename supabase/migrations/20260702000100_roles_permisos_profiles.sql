-- Base del modelo de permisos: RBAC + overrides individuales.
-- Ver arquitectura completa en integrakin-crm-arquitectura-base.md (Chat 1)

create table roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  resource text not null,   -- 'clientes' | 'leads' | 'tickets'
  action text not null,     -- 'view' | 'view_all' | 'create' | 'edit' | 'delete' | 'assign'
  unique(resource, action)
);

create table role_permissions (
  role_id uuid references roles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role_id uuid references roles(id),
  active boolean default true,
  created_at timestamptz default now()
);

create table user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  effect text check (effect in ('grant','revoke')) not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(user_id, permission_id)
);

-- Función central de resolución: override > rol
create or replace function has_permission(p_user uuid, p_resource text, p_action text)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_override text;
  v_role_has boolean;
begin
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
    from profiles pr
    join role_permissions rp on rp.role_id = pr.role_id
    join permissions p on p.id = rp.permission_id
    where pr.id = p_user and p.resource = p_resource and p.action = p_action
  ) into v_role_has;

  return coalesce(v_role_has, false);
end;
$$;

-- Trigger: crea automáticamente el profile cuando se crea un auth.user
-- (rol queda null hasta que un admin lo asigne desde el panel)
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
