-- supabase/migrations/20260711000000_reportes_widgets.sql
--
-- Convierte el contenido de la página /reportes (que se elimina, ver Task 4)
-- en widgets asignables del dashboard. kpi.tasa_conversion no existía en el
-- catálogo pese a que 20260709000100 ya le había preparado la columna
-- resource='leads' sobre una fila que nunca se insertó; acá se crea
-- directamente con resource='reportes', que es lo correcto ahora que las 4
-- métricas comparten fuente de datos (vista_funnel_leads).

insert into dashboard_widgets (key, label, component, tipo, resource, descripcion) values
  ('kpi.total_leads', 'Total leads', 'WidgetsKpiTotalLeads', 'kpi', 'reportes', 'Cantidad total de leads en el pipeline'),
  ('kpi.leads_ganados', 'Leads ganados', 'WidgetsKpiLeadsGanados', 'kpi', 'reportes', 'Leads cerrados como ganados'),
  ('kpi.leads_perdidos', 'Leads perdidos', 'WidgetsKpiLeadsPerdidos', 'kpi', 'reportes', 'Leads cerrados como perdidos'),
  ('kpi.tasa_conversion', 'Tasa de conversión', 'WidgetsKpiTasaConversion', 'kpi', 'reportes', 'Porcentaje de leads ganados sobre cerrados'),
  ('chart.funnel_leads', 'Funnel de leads', 'WidgetsChartFunnelLeads', 'chart', 'reportes', 'Distribución de leads por estado del pipeline'),
  ('chart.performance_vendedores', 'Performance por vendedor', 'WidgetsChartPerformanceVendedores', 'chart', 'reportes', 'Leads ganados y tickets resueltos por vendedor')
on conflict (key) do nothing;
