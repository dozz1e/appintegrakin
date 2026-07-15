-- supabase/migrations/20260714220000_notificacion_tickets_post_venta_vencidos.sql
--
-- "Vencer" no es un evento de escritura, se revisa por cron (mismo patrón
-- que fn_notificar_tareas_vencidas / fn_notificar_citas_vencidas).
--
-- A diferencia de esos dos, acá no hay owner_id individual (decisión
-- explícita del usuario: todo el equipo post_venta ve/edita todo por
-- igual), así que el destinatario es un broadcast a TODOS los profiles
-- con rol 'post_venta' (no a dueña, aunque dueña también tenga acceso a
-- la vista) - un ticket vencido genera una fila de notificación por cada
-- integrante del equipo.

alter table notificaciones drop constraint notificaciones_tipo_check;
alter table notificaciones add constraint notificaciones_tipo_check
  check (tipo in (
    'lead_asignado','ticket_asignado','tarea_asignada','tarea_vencida',
    'capacitacion_asignada','capacitacion_vencida',
    'ticket_post_venta_vencido'
  ));

alter table notificaciones drop constraint notificaciones_entidad_tipo_check;
alter table notificaciones add constraint notificaciones_entidad_tipo_check
  check (entidad_tipo in ('lead','cliente','ticket','tarea','ticket_post_venta'));

create or replace function fn_notificar_tickets_post_venta_vencidos()
returns void
language plpgsql
security definer
as $$
begin
  with vencidos as (
    update tickets_post_venta
    set notificada_vencida = true
    where fecha_tope < current_date
      and estado <> 'despachado'
      and not notificada_vencida
    returning id, n_guia
  ),
  destinatarios as (
    select pr.profile_id
    from profile_roles pr
    join roles r on r.id = pr.role_id
    where r.name = 'post_venta'
  )
  insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
  select d.profile_id, 'ticket_post_venta_vencido', 'Ticket post-venta vencido',
         'Guía ' || v.n_guia || ' pasó la fecha tope', 'ticket_post_venta', v.id
  from vencidos v cross join destinatarios d;
end;
$$;

select cron.schedule(
  'notificar-tickets-post-venta-vencidos',
  '0 * * * *',
  $$select fn_notificar_tickets_post_venta_vencidos()$$
);

create or replace function fn_resetear_notificada_vencida_tpv()
returns trigger
language plpgsql
as $$
begin
  if old.notificada_vencida
     and (new.fecha_tope is distinct from old.fecha_tope
          or (old.estado = 'despachado' and new.estado <> 'despachado')) then
    new.notificada_vencida := false;
  end if;
  return new;
end;
$$;

create trigger trg_resetear_notificada_vencida_tpv before update on tickets_post_venta
  for each row execute function fn_resetear_notificada_vencida_tpv();
