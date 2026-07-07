-- 20260703000000_superadmin_features.sql
--
-- Dos cosas separadas a propósito:
--
-- 1) superadmins: identidad de superusuario, fuera del sistema de roles de negocio.
--    No es un "rol" en la tabla roles porque esa tabla es visible/gestionable
--    para el negocio (o podría llegar a serlo en un futuro panel de admin de
--    Integrakin) y esto tiene que quedar completamente fuera de esa capa.
--
-- 2) features / user_features: catálogo de "cosas activables por usuario"
--    que NO son permisos CRUD sobre un recurso de negocio (eso ya lo cubre
--    has_permission). Son componentes, vistas o funciones sueltas que se
--    prenden para una persona puntual sin tocar su rol.

create table superadmins (
  user_id uuid primary key references profiles(id) on delete cascade,
  created_at timestamptz default now()
);

alter table superadmins enable row level security;

-- Cada usuario solo puede confirmar SI ES superadmin (para decidir si el
-- frontend le muestra el menú oculto), pero nadie puede listar quiénes más
-- lo son -- ni la dueña, ni nadie con el anon/authenticated key.
create policy superadmins_select_own on superadmins
for select using (user_id = auth.uid());

-- A propósito NO hay policy de insert/update/delete. Nadie puede agregarse
-- a esta tabla desde la app, ni siquiera un superadmin existente. Se agrega
-- a mano, por ti, con el service role o directo en el SQL editor de Supabase.

create table features (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,      -- ej. 'dashboard.reporte_avanzado', 'panel.exportar_todo'
  label text not null,
  description text,
  created_at timestamptz default now()
);

create table user_features (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  feature_id uuid references features(id) on delete cascade,
  enabled boolean default true,
  granted_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(user_id, feature_id)
);

alter table features enable row level security;
alter table user_features enable row level security;

-- Solo superadmins pueden ver/gestionar el catálogo completo de features.
create policy features_superadmin on features
for all using (exists (select 1 from superadmins where user_id = auth.uid()));

-- user_features: cada quien ve sus propias filas (necesario para que el
-- frontend sepa qué mostrarle), superadmin ve/gestiona todas.
create policy user_features_select_own on user_features
for select using (
  user_id = auth.uid()
  or exists (select 1 from superadmins where user_id = auth.uid())
);

create policy user_features_write_superadmin on user_features
for insert with check (exists (select 1 from superadmins where user_id = auth.uid()));

create policy user_features_update_superadmin on user_features
for update using (exists (select 1 from superadmins where user_id = auth.uid()));

create policy user_features_delete_superadmin on user_features
for delete using (exists (select 1 from superadmins where user_id = auth.uid()));

-- RPC: devuelve solo las keys activas del usuario actual. Es security definer
-- a propósito, así un usuario normal puede llamarla sin tener select directo
-- sobre features/user_features (que están reservadas a superadmin).
create or replace function mis_features()
returns table (key text)
language sql
security definer
stable
as $$
  select f.key
  from user_features uf
  join features f on f.id = uf.feature_id
  where uf.user_id = auth.uid() and uf.enabled = true;
$$;

-- Bypass total para superadmin en el sistema de permisos de negocio existente.
-- Así tu cuenta ve y edita clientes/leads/tickets sin necesitar un role_id
-- de negocio asignado.
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
    from profiles pr
    join role_permissions rp on rp.role_id = pr.role_id
    join permissions p on p.id = rp.permission_id
    where pr.id = p_user and p.resource = p_resource and p.action = p_action
  ) into v_role_has;

  return coalesce(v_role_has, false);
end;
$$;
