-- Permite borrar (no solo marcar leída) las propias notificaciones desde la
-- campanita.

create policy delete_notificaciones_propias on notificaciones
for delete using (user_id = auth.uid());
