-- supabase/migrations/20260714070000_notificacion_capacitacion_asignada.sql
--
-- Mismo patrón que fn_notificar_tarea_asignada (ver
-- 20260702000600.../notificaciones existentes): notifica al responsable
-- cuando se le asigna una cita que no creó él mismo.
--
-- notificaciones_tipo_check no incluye los tipos nuevos de esta feature
-- (bug detectado en implementación real: el brief original solo tenía el
-- trigger, sin esta ALTER TABLE, y el insert fallaba con constraint
-- violation). Se agregan aquí los dos valores que usa todo el módulo
-- (capacitacion_asignada en este archivo, capacitacion_vencida en el cron
-- de Task 4) para no tocar esta tabla dos veces.
alter table notificaciones drop constraint notificaciones_tipo_check;
alter table notificaciones add constraint notificaciones_tipo_check
  check (tipo in ('lead_asignado','ticket_asignado','tarea_asignada','tarea_vencida','capacitacion_asignada','capacitacion_vencida'));

create or replace function fn_notificar_capacitacion_asignada()
returns trigger
language plpgsql
security definer
as $$
declare
  v_cliente text;
begin
  if new.owner_id is not null and new.owner_id != new.created_by then
    select razon_social into v_cliente from clientes where id = new.cliente_id;
    insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
    values (new.owner_id, 'capacitacion_asignada', 'Capacitación asignada', v_cliente, 'cliente', new.cliente_id);
  end if;
  return new;
end;
$$;

create trigger trg_notificar_capacitacion_asignada after insert on citas_capacitacion
  for each row execute function fn_notificar_capacitacion_asignada();
