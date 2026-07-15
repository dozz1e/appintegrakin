-- supabase/migrations/20260715030000_cron_archivar_cerrados.sql
--
-- Archiva (nunca borra) leads/tickets/tickets_post_venta cerrados hace más
-- de los días configurados en configuracion_archivado. Corre una vez al
-- día (no hace falta más frecuencia para una ventana de días). Ver spec
-- 2026-07-15-historial-estados-archivado-design.md.

create or replace function fn_archivar_cerrados()
returns void
language plpgsql
security definer
as $$
begin
  update leads set archivado = true
  where estado in ('ganado', 'perdido') and not archivado
    and fecha_cierre < now() - (
      (select dias from configuracion_archivado where modulo = 'leads') || ' days'
    )::interval;

  update tickets set archivado = true
  where estado in ('resuelto', 'cerrado') and not archivado
    and fecha_cierre < now() - (
      (select dias from configuracion_archivado where modulo = 'tickets') || ' days'
    )::interval;

  update tickets_post_venta set archivado = true
  where estado = 'despachado' and not archivado
    and fecha_cierre < now() - (
      (select dias from configuracion_archivado where modulo = 'tickets_post_venta') || ' days'
    )::interval;
end;
$$;

select cron.schedule('archivar-cerrados', '0 3 * * *', $$select fn_archivar_cerrados()$$);
