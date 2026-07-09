-- Notificaciones in-app (campanita): se generan por trigger al asignar
-- lead/ticket/tarea a un usuario. Realtime se habilita en la siguiente
-- migración. Falta el tipo 'tarea_vencida' (requiere pg_cron o job externo
-- que revise fecha_vencimiento < now() and completada = false, no trigger).
--
-- Migración retroactiva: ya estaba aplicada en la base real (corrida a mano
-- en el SQL Editor de Supabase); este archivo documenta y versiona ese
-- esquema tal como está desplegado hoy.

create table notificaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  tipo text check (tipo in ('lead_asignado','ticket_asignado','tarea_asignada','tarea_vencida')) not null,
  titulo text not null,
  mensaje text,
  entidad_tipo text check (entidad_tipo in ('lead','cliente','ticket','tarea')) not null,
  entidad_id uuid not null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notificaciones_user on notificaciones(user_id, leida);

alter table notificaciones enable row level security;

create policy select_notificaciones_propias on notificaciones
for select using (user_id = auth.uid());

create policy update_notificaciones_propias on notificaciones
for update using (user_id = auth.uid());

create or replace function fn_notificar_lead_asignado()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.owner_id is not null and new.owner_id is distinct from old.owner_id then
    insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
    values (new.owner_id, 'lead_asignado', 'Te asignaron un lead', new.nombre, 'lead', new.id);
  end if;
  return new;
end;
$$;

create trigger trg_lead_asignado after update on leads
  for each row execute function fn_notificar_lead_asignado();

create or replace function fn_notificar_ticket_asignado()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.owner_id is not null and new.owner_id is distinct from old.owner_id then
    insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
    values (new.owner_id, 'ticket_asignado', 'Te asignaron un ticket', new.titulo, 'ticket', new.id);
  end if;
  return new;
end;
$$;

create trigger trg_ticket_asignado after update on tickets
  for each row execute function fn_notificar_ticket_asignado();

create or replace function fn_notificar_tarea_asignada()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.owner_id is not null and new.owner_id is distinct from new.created_by then
    insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
    values (new.owner_id, 'tarea_asignada', 'Te asignaron una tarea', new.titulo, 'tarea', new.id);
  end if;
  return new;
end;
$$;

create trigger trg_tarea_asignada after insert on tareas
  for each row execute function fn_notificar_tarea_asignada();
