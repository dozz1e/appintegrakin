-- supabase/migrations/20260722220000_entidad_imagenes_capacitacion_nota.sql
--
-- Habilita adjuntos en anotaciones de capacitación reutilizando la galería
-- genérica entidad_imagenes (mismo patrón que cliente_interaccion/etc).

alter table entidad_imagenes drop constraint entidad_imagenes_entidad_tipo_check;
alter table entidad_imagenes add constraint entidad_imagenes_entidad_tipo_check
  check (entidad_tipo in ('cliente_interaccion', 'lead_interaccion', 'ticket', 'ticket_post_venta', 'capacitacion_nota'));

drop policy select_entidad_imagenes on entidad_imagenes;
create policy select_entidad_imagenes on entidad_imagenes for select using (
  (entidad_tipo = 'cliente_interaccion' and exists (select 1 from cliente_interacciones ci where ci.id = entidad_imagenes.entidad_id)) or
  (entidad_tipo = 'lead_interaccion' and exists (select 1 from lead_interacciones li where li.id = entidad_imagenes.entidad_id)) or
  (entidad_tipo = 'ticket' and exists (select 1 from tickets t where t.id = entidad_imagenes.entidad_id)) or
  (entidad_tipo = 'ticket_post_venta' and exists (select 1 from tickets_post_venta tpv where tpv.id = entidad_imagenes.entidad_id)) or
  (entidad_tipo = 'capacitacion_nota' and exists (select 1 from citas_capacitacion_notas cn where cn.id = entidad_imagenes.entidad_id))
);

drop policy insert_entidad_imagenes on entidad_imagenes;
create policy insert_entidad_imagenes on entidad_imagenes for insert with check (
  created_by = auth.uid() and (
    (entidad_tipo = 'cliente_interaccion' and exists (select 1 from cliente_interacciones ci where ci.id = entidad_imagenes.entidad_id)) or
    (entidad_tipo = 'lead_interaccion' and exists (select 1 from lead_interacciones li where li.id = entidad_imagenes.entidad_id)) or
    (entidad_tipo = 'ticket' and exists (select 1 from tickets t where t.id = entidad_imagenes.entidad_id)) or
    (entidad_tipo = 'ticket_post_venta' and exists (select 1 from tickets_post_venta tpv where tpv.id = entidad_imagenes.entidad_id)) or
    (entidad_tipo = 'capacitacion_nota' and exists (select 1 from citas_capacitacion_notas cn where cn.id = entidad_imagenes.entidad_id))
  )
);
