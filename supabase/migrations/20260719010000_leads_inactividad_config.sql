alter table leads add column notificado_inactividad boolean not null default false;

-- Una interacción registrada cuenta como actividad: bump updated_at.
-- El trigger de leads (más abajo) resetea notificado_inactividad
-- cuando detecta que updated_at cambió, así que no hace falta
-- resetear el flag acá también.
create or replace function fn_bump_lead_actividad()
returns trigger
language plpgsql
security definer
as $$
begin
  update leads set updated_at = now() where id = new.lead_id;
  return new;
end;
$$;

create trigger trg_lead_interaccion_actividad
  after insert on lead_interacciones
  for each row execute function fn_bump_lead_actividad();

-- Resetea el aviso apenas hay actividad nueva (edición o interacción,
-- ambas bumpean updated_at). Mismo patrón que
-- fn_resetear_notificada_vencida, pero disparado por updated_at en
-- vez de por fecha_vencimiento/completada.
create or replace function fn_resetear_notificado_inactividad()
returns trigger
language plpgsql
as $$
begin
  if old.notificado_inactividad and new.updated_at is distinct from old.updated_at then
    new.notificado_inactividad := false;
  end if;
  return new;
end;
$$;

create trigger trg_resetear_notificado_inactividad before update on leads
  for each row execute function fn_resetear_notificado_inactividad();

-- Config global (no por usuario) de días de inactividad antes de avisar.
create table configuracion_alertas (
  clave text primary key,
  valor integer not null check (valor > 0)
);

insert into configuracion_alertas (clave, valor) values ('leads_inactividad_dias', 4);

alter table configuracion_alertas enable row level security;

create policy select_configuracion_alertas on configuracion_alertas
for select using (auth.uid() is not null);

create policy update_configuracion_alertas on configuracion_alertas
for update using (has_permission(auth.uid(), 'configuracion_alertas', 'edit'));

insert into permissions (resource, action) values
  ('configuracion_alertas', 'edit')
on conflict (resource, action) do nothing;

do $$
declare
  r_id uuid;
  p_id uuid;
begin
  select id into r_id from roles where name = 'dueña';
  if r_id is not null then
    select p.id into p_id from permissions p where p.resource = 'configuracion_alertas' and p.action = 'edit';
    if p_id is not null then
      insert into role_permissions (role_id, permission_id) values (r_id, p_id) on conflict do nothing;
    end if;
  end if;
end $$;
