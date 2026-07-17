-- Pedido del usuario: cualquiera que pueda VER el calendario debe poder
-- eliminar una cita, no solo quien tenga el permiso capacitaciones.delete
-- (hoy solo dueña, ver 20260716070000_permiso_delete_citas_capacitacion.sql).
-- Se reemplaza la policy de delete para que use el mismo criterio que
-- select_citas_capacitacion: dueño de la cita, o quien tenga
-- capacitaciones.view_all. Superadmin sigue cubierto porque
-- has_permission() bypasea todo internamente (gotcha #15).

drop policy delete_citas_capacitacion on citas_capacitacion;

create policy delete_citas_capacitacion on citas_capacitacion
for delete using (
  owner_id = auth.uid()
  or has_permission(auth.uid(), 'capacitaciones', 'view_all')
);
