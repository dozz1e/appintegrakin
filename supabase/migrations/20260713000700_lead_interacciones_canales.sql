-- Reemplaza el set de canales de interacción de lead: se deja solo los
-- canales reales de contacto usados por el negocio (redes + los que ya
-- había). Sin datos existentes con los canales viejos (texto/telefono).

alter table lead_interacciones drop constraint lead_interacciones_canal_check;

alter table lead_interacciones add constraint lead_interacciones_canal_check
  check (canal in ('whatsapp', 'instagram', 'facebook', 'llamada', 'web', 'correo'));
