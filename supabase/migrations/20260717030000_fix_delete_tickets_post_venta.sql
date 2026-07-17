-- Bug: 20260715234500_permiso_delete_tickets_post_venta.sql agregó el
-- permiso tickets_post_venta.delete y se lo dio a "dueña", pero nunca se
-- creó la policy RLS de delete sobre tickets_post_venta (la tabla solo
-- tenía select/insert/update). Sin policy de delete, RLS bloquea el
-- borrado para TODOS sin importar el permiso - el botón "Eliminar" no
-- tiraba error (ver gotcha #18, eliminarTicket() en
-- useTicketsPostVenta.ts no revisaba filas afectadas) así que parecía
-- funcionar. Reportado con Renzo Cáceres, a quien se le dio el permiso
-- por override individual y el botón salía pero no borraba nada.
--
-- Sin owner_id en esta tabla (todo el equipo post_venta ve/edita por
-- igual, ver CONTEXTO_PROYECTO.md) - la policy es puramente por permiso,
-- mismo patrón que tickets_delete/leads_delete.

create policy delete_tickets_post_venta on tickets_post_venta
for delete using (has_permission(auth.uid(), 'tickets_post_venta', 'delete'));
