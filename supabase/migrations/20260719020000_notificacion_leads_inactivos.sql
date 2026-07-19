alter table notificaciones drop constraint notificaciones_tipo_check;
alter table notificaciones add constraint notificaciones_tipo_check
  check (tipo = any (array[
    'lead_asignado', 'ticket_asignado', 'tarea_asignada', 'tarea_vencida',
    'capacitacion_asignada', 'capacitacion_vencida', 'ticket_post_venta_vencido',
    'lead_inactivo'
  ]));

create or replace function fn_notificar_leads_inactivos()
returns void
language plpgsql
security definer
as $$
declare
  v_dias integer;
begin
  select valor into v_dias from configuracion_alertas where clave = 'leads_inactividad_dias';
  if v_dias is null then v_dias := 4; end if;

  with inactivos as (
    update leads
    set notificado_inactividad = true
    where estado not in ('ganado', 'perdido')
      and not archivado
      and updated_at < now() - (v_dias || ' days')::interval
      and not notificado_inactividad
      and coalesce(owner_id, created_by) is not null
    returning id, nombre, coalesce(owner_id, created_by) as destinatario
  )
  insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
  select destinatario, 'lead_inactivo', 'Lead sin actividad', nombre, 'lead', id
  from inactivos;
end;
$$;

select cron.schedule(
  'notificar-leads-inactivos',
  '0 * * * *',
  $$select fn_notificar_leads_inactivos()$$
);
