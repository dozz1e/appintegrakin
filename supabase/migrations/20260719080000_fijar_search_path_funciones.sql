-- supabase/migrations/20260719080000_fijar_search_path_funciones.sql
--
-- Todas las funciones SECURITY DEFINER (y los triggers) del proyecto
-- quedaron sin search_path fijo. Sin esto, alguien con permiso de crear
-- objetos en un schema que aparezca antes en el search_path del caller
-- podría "sombrear" una tabla/función que estas funciones referencian
-- sin calificar (ej. crear public.profiles en otro schema priorizado).
-- Fijar search_path = public cierra ese vector sin tocar el cuerpo de
-- ninguna función.

alter function public.convertir_lead_a_cliente(uuid, text, text) set search_path = public;
alter function public.fn_archivar_cerrados() set search_path = public;
alter function public.fn_bump_lead_actividad() set search_path = public;
alter function public.fn_gestionar_cierre_leads() set search_path = public;
alter function public.fn_gestionar_cierre_tickets() set search_path = public;
alter function public.fn_gestionar_cierre_tickets_post_venta() set search_path = public;
alter function public.fn_incrementar_version() set search_path = public;
alter function public.fn_notificar_capacitacion_asignada() set search_path = public;
alter function public.fn_notificar_citas_vencidas() set search_path = public;
alter function public.fn_notificar_lead_asignado() set search_path = public;
alter function public.fn_notificar_leads_inactivos() set search_path = public;
alter function public.fn_notificar_tarea_asignada() set search_path = public;
alter function public.fn_notificar_tareas_vencidas() set search_path = public;
alter function public.fn_notificar_ticket_asignado() set search_path = public;
alter function public.fn_notificar_tickets_post_venta_vencidos() set search_path = public;
alter function public.fn_resetear_notificada_vencida() set search_path = public;
alter function public.fn_resetear_notificada_vencida_citas() set search_path = public;
alter function public.fn_resetear_notificada_vencida_tpv() set search_path = public;
alter function public.fn_resetear_notificado_inactividad() set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.has_permission(uuid, text, text) set search_path = public;
alter function public.mis_features() set search_path = public;
alter function public.mis_widgets() set search_path = public;
alter function public.permisos_efectivos_usuario(uuid) set search_path = public;
alter function public.proteger_cambio_rol() set search_path = public;
alter function public.registrar_auditoria() set search_path = public;
alter function public.registrar_historial_estado() set search_path = public;
alter function public.usuarios_por_rol(text) set search_path = public;
