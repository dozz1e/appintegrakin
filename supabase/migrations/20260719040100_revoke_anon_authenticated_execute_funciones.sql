-- supabase/migrations/20260719040100_revoke_anon_authenticated_execute_funciones.sql
--
-- La migración anterior (revoke_public_execute_funciones) revocó solo
-- de PUBLIC, pero Supabase otorga EXECUTE a anon/authenticated
-- directamente via ALTER DEFAULT PRIVILEGES al crear cada función
-- (no via PUBLIC) — confirmado en pg_default_acl. Esa migración no
-- cerró el acceso anónimo real. Esta lo corrige.

revoke execute on function public.convertir_lead_a_cliente(uuid, text, text) from anon, authenticated;
revoke execute on function public.fn_archivar_cerrados() from anon, authenticated;
revoke execute on function public.fn_bump_lead_actividad() from anon, authenticated;
revoke execute on function public.fn_conteo_tickets_cliente(uuid) from anon, authenticated;
revoke execute on function public.fn_gestionar_cierre_leads() from anon, authenticated;
revoke execute on function public.fn_gestionar_cierre_tickets() from anon, authenticated;
revoke execute on function public.fn_gestionar_cierre_tickets_post_venta() from anon, authenticated;
revoke execute on function public.fn_incrementar_version() from anon, authenticated;
revoke execute on function public.fn_notificar_capacitacion_asignada() from anon, authenticated;
revoke execute on function public.fn_notificar_citas_vencidas() from anon, authenticated;
revoke execute on function public.fn_notificar_lead_asignado() from anon, authenticated;
revoke execute on function public.fn_notificar_leads_inactivos() from anon, authenticated;
revoke execute on function public.fn_notificar_tarea_asignada() from anon, authenticated;
revoke execute on function public.fn_notificar_tareas_vencidas() from anon, authenticated;
revoke execute on function public.fn_notificar_ticket_asignado() from anon, authenticated;
revoke execute on function public.fn_notificar_tickets_post_venta_vencidos() from anon, authenticated;
revoke execute on function public.fn_resetear_notificada_vencida() from anon, authenticated;
revoke execute on function public.fn_resetear_notificada_vencida_citas() from anon, authenticated;
revoke execute on function public.fn_resetear_notificada_vencida_tpv() from anon, authenticated;
revoke execute on function public.fn_resetear_notificado_inactividad() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.has_permission(uuid, text, text) from anon, authenticated;
revoke execute on function public.mis_features() from anon, authenticated;
revoke execute on function public.mis_widgets() from anon, authenticated;
revoke execute on function public.permisos_efectivos_usuario(uuid) from anon, authenticated;
revoke execute on function public.proteger_cambio_rol() from anon, authenticated;
revoke execute on function public.registrar_auditoria() from anon, authenticated;
revoke execute on function public.registrar_historial_estado() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;
revoke execute on function public.usuarios_por_rol(text) from anon, authenticated;

grant execute on function public.has_permission(uuid, text, text) to authenticated;
grant execute on function public.mis_features() to authenticated;
grant execute on function public.mis_widgets() to authenticated;
grant execute on function public.permisos_efectivos_usuario(uuid) to authenticated;
grant execute on function public.usuarios_por_rol(text) to authenticated;
grant execute on function public.convertir_lead_a_cliente(uuid, text, text) to authenticated;
grant execute on function public.fn_conteo_tickets_cliente(uuid) to authenticated;

-- Sin esto, cualquier función nueva vuelve a nacer ejecutable por
-- anon/authenticated (mismo hueco de origen). Todas las funciones
-- custom actuales tienen owner postgres.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
