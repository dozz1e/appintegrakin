-- 20260702000900_rls_profiles.sql
--
-- profiles se creó sin RLS en la migración base. Sin esto, cualquier usuario
-- autenticado podía leer y EDITAR cualquier fila de profiles -- incluyendo
-- subirse el role_id a sí mismo. Se cierra acá.
--
-- Necesitamos que los usuarios puedan VER perfiles ajenos (para elegir a quién
-- asignar un lead o ticket), pero no editar el rol de nadie desde el cliente.

alter table profiles enable row level security;

-- Todo usuario autenticado puede ver la lista de perfiles (nombre, email, rol)
-- - es información interna del CRM, no hay dato sensible acá.
create policy profiles_select on profiles
for select using (auth.role() = 'authenticated');

-- Cada usuario puede actualizar SU propia fila (ej. cambiar su nombre)...
create policy profiles_update_own on profiles
for update using (id = auth.uid()) with check (id = auth.uid());

-- ...pero el trigger bloquea que se cambie role_id o active desde el cliente,
-- incluso en su propia fila. Solo el service role (scripts/admin, sin JWT de
-- usuario) puede tocar esos dos campos, porque auth.uid() es null en ese caso.
create or replace function proteger_cambio_rol()
returns trigger
language plpgsql
security definer
as $$
begin
  if (new.role_id is distinct from old.role_id or new.active is distinct from old.active)
     and auth.uid() is not null then
    raise exception 'Solo un administrador puede cambiar rol o estado activo de un usuario';
  end if;
  return new;
end;
$$;

create trigger trg_proteger_cambio_rol
  before update on profiles
  for each row execute function proteger_cambio_rol();
