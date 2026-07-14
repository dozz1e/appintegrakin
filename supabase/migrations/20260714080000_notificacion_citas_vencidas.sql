-- supabase/migrations/20260714080000_notificacion_citas_vencidas.sql
--
-- Mismo patrón que fn_notificar_tareas_vencidas
-- (20260710000000_notificacion_tarea_vencida.sql): "vencer" no es un evento
-- de escritura, se revisa por cron.
--
-- notificaciones_tipo_check ya incluye 'capacitacion_vencida' — se agregó
-- en la migración de Task 3 (20260714070000) junto con
-- 'capacitacion_asignada', no hace falta otra ALTER TABLE acá.

create or replace function fn_notificar_citas_vencidas()
returns void
language plpgsql
security definer
as $$
begin
  with vencidas as (
    update citas_capacitacion
    set notificada_vencida = true
    where fecha_hora < now()
      and estado = 'pendiente'
      and not notificada_vencida
      and owner_id is not null
    returning id, cliente_id, owner_id
  )
  insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
  select v.owner_id, 'capacitacion_vencida', 'Capacitación vencida', c.razon_social, 'cliente', v.cliente_id
  from vencidas v join clientes c on c.id = v.cliente_id;
end;
$$;

select cron.schedule(
  'notificar-citas-vencidas',
  '0 * * * *',
  $$select fn_notificar_citas_vencidas()$$
);

create or replace function fn_resetear_notificada_vencida_citas()
returns trigger
language plpgsql
as $$
begin
  if old.notificada_vencida
     and (new.fecha_hora is distinct from old.fecha_hora
          or (old.estado != 'pendiente' and new.estado = 'pendiente')) then
    new.notificada_vencida := false;
  end if;
  return new;
end;
$$;

create trigger trg_resetear_notificada_vencida_citas before update on citas_capacitacion
  for each row execute function fn_resetear_notificada_vencida_citas();
