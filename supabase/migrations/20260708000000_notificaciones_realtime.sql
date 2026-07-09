-- Habilita Realtime (websocket) sobre notificaciones para que la campanita
-- se actualice en vivo, sin polling.
-- Migración retroactiva: ya estaba aplicada en la base real; este archivo
-- documenta y versiona ese cambio.

alter publication supabase_realtime add table notificaciones;
