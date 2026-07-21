-- 20260721101335_widgets_lider_venta_post_venta.sql
--
-- Dos dashboards nuevos en el catálogo:
--
-- 'lider_venta' (Natalia): reutiliza los MISMOS componentes del dashboard
-- 'vendedores' (RLS ya los muestra team-wide para quien tiene view_all en
-- leads/clientes - Natalia ya lo tiene), más el ranking de performance por
-- vendedor (fn_performance_vendedores, valida el permiso server-side).
--
-- 'post_venta': tickets_post_venta no tiene owner_id (siempre es
-- team-wide), componentes nuevos.

insert into dashboard_widgets (key, label, component, resource, tipo, descripcion, dashboard) values
  ('kpi.clientes_totales_lider', 'Clientes totales', 'WidgetsKpiClientesTotales', 'clientes', 'kpi', 'Total de clientes del equipo', 'lider_venta'),
  ('kpi.total_leads_lider', 'Total leads', 'WidgetsKpiTotalLeads', 'leads', 'kpi', 'Total histórico de leads del equipo', 'lider_venta'),
  ('kpi.tasa_conversion_lider', 'Tasa de conversión', 'WidgetsKpiTasaConversion', 'leads', 'kpi', '% de leads cerrados que terminaron ganados, equipo completo', 'lider_venta'),
  ('kpi.leads_ganados_lider', 'Leads ganados', 'WidgetsKpiLeadsGanados', 'leads', 'kpi', 'Leads cerrados como venta, equipo completo', 'lider_venta'),
  ('chart.leads_tendencia_lider', 'Leads captados (30 días)', 'WidgetsChartLeadsTendencia', 'leads', 'chart', 'Leads del equipo por día y estado', 'lider_venta'),
  ('chart.leads_por_estado_lider', 'Leads y sus estados', 'WidgetsChartLeadsPorEstado', 'leads', 'chart', 'Distribución de leads del equipo por estado', 'lider_venta'),
  ('tabla.lead_management_lider', 'Lead management', 'WidgetsTablaLeadManagement', 'leads', 'tabla', 'Tabla de leads del equipo con búsqueda', 'lider_venta'),
  ('chart.performance_vendedores', 'Performance por vendedor', 'WidgetsChartPerformanceVendedores', 'reportes', 'chart', 'Ranking de leads ganados por vendedor', 'lider_venta'),

  ('kpi.post_venta_total', 'Total tickets (Post venta)', 'WidgetsKpiTicketsPostVentaTotal', 'tickets_post_venta', 'kpi', 'Total histórico de tickets post venta', 'post_venta'),
  ('kpi.post_venta_despachados', 'Despachados (Post venta)', 'WidgetsKpiTicketsPostVentaDespachados', 'tickets_post_venta', 'kpi', 'Tickets ya despachados', 'post_venta'),
  ('kpi.post_venta_vencidos', 'Vencidos (Post venta)', 'WidgetsKpiTicketsPostVentaVencidos', 'tickets_post_venta', 'kpi', 'Tickets activos con fecha tope ya pasada', 'post_venta'),
  ('kpi.post_venta_en_proceso', 'En proceso (Post venta)', 'WidgetsKpiTicketsPostVentaEnProceso', 'tickets_post_venta', 'kpi', 'Tickets activos que todavía no vencen', 'post_venta'),
  ('chart.post_venta_tendencia', 'Tendencia post venta', 'WidgetsChartTicketsPostVentaTendencia', 'tickets_post_venta', 'chart', 'Tickets por día y estado, reconstruido con historial_estados', 'post_venta'),
  ('chart.post_venta_por_estado', 'Tickets y sus estados', 'WidgetsChartTicketsPostVentaPorEstado', 'tickets_post_venta', 'chart', 'Distribución de tickets post venta por estado', 'post_venta'),
  ('tabla.post_venta_management', 'Post venta management', 'WidgetsTablaPostVentaManagement', 'tickets_post_venta', 'tabla', 'Tabla de tickets post venta con búsqueda', 'post_venta')
on conflict (key) do nothing;
