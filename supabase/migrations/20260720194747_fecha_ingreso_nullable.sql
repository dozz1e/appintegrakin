-- supabase/migrations/20260720194747_fecha_ingreso_nullable.sql
--
-- fecha_ingreso ya no se pide al crear el ticket: se marca sola cuando
-- el estado pasa a 'ingreso_equipo' (ver TicketForm.vue / [id].vue).
-- Antes del cambio de estado el equipo aún no ha ingresado físicamente,
-- así que forzar un default de hoy era incorrecto.

alter table tickets_post_venta
  alter column fecha_ingreso drop not null,
  alter column fecha_ingreso drop default;
