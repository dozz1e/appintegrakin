-- supabase/migrations/20260710000000_notificacion_tarea_vencida.sql
--
-- Cierra el punto pendiente del roadmap: notificación tarea_vencida.
-- "Vencer" no es un evento de escritura, así que no se puede resolver con
-- un trigger normal como los otros 3 tipos de notificación ya existentes
-- (lead_asignado/ticket_asignado/tarea_asignada) — se usa pg_cron para
-- revisar tareas vencidas cada hora.

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

alter table tareas add column notificada_vencida boolean not null default false;

-- security definer: el cron corre sin auth.uid(), necesita bypasear la
-- policy de update de tareas (owner_id = auth.uid() or view_all) igual
-- que los triggers de notificación existentes.
create or replace function fn_notificar_tareas_vencidas()
returns void
language plpgsql
security definer
as $$
begin
  with vencidas as (
    update tareas
    set notificada_vencida = true
    where fecha_vencimiento < now()
      and not completada
      and not notificada_vencida
      and coalesce(owner_id, created_by) is not null
    returning id, titulo, coalesce(owner_id, created_by) as destinatario
  )
  insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
  select destinatario, 'tarea_vencida', 'Tarea vencida', titulo, 'tarea', id
  from vencidas;
end;
$$;

select cron.schedule(
  'notificar-tareas-vencidas',
  '0 * * * *',
  $$select fn_notificar_tareas_vencidas()$$
);

-- Si se reabre (completada true -> false) o se reprograma una tarea que
-- ya había avisado, permite que vuelva a avisar si vence de nuevo.
create or replace function fn_resetear_notificada_vencida()
returns trigger
language plpgsql
as $$
begin
  if old.notificada_vencida
     and (new.fecha_vencimiento is distinct from old.fecha_vencimiento
          or (old.completada and not new.completada)) then
    new.notificada_vencida := false;
  end if;
  return new;
end;
$$;

create trigger trg_resetear_notificada_vencida before update on tareas
  for each row execute function fn_resetear_notificada_vencida();
