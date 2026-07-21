-- 20260721091452_widgets_vendedores.sql
--
-- Primer set de widgets del rediseño desde cero (KpiCard con delta real,
-- gráfica de tendencia de leads, ranking de estados, tabla de leads).
--
-- Agrega agrupación por 'dashboard' al catálogo, para que admin/dashboards
-- ya no muestre todos los widgets juntos en un listado plano sino separados
-- por a qué dashboard pertenecen (ej. 'vendedores'). No reemplaza el
-- 'resource' existente (ese sigue siendo el resource de permisos); esto es
-- puramente una agrupación visual para el panel de asignación.

alter table dashboard_widgets add column dashboard text not null default 'vendedores';
alter table dashboard_widgets alter column dashboard drop default;

alter table dashboard_widgets drop constraint dashboard_widgets_tipo_check;
alter table dashboard_widgets add constraint dashboard_widgets_tipo_check
  check (tipo in ('kpi', 'chart', 'tabla'));

insert into dashboard_widgets (key, label, component, resource, tipo, descripcion, dashboard) values
  ('kpi.clientes_totales', 'Clientes totales', 'WidgetsKpiClientesTotales', 'clientes', 'kpi', 'Total de clientes registrados', 'vendedores'),
  ('kpi.total_leads', 'Total leads', 'WidgetsKpiTotalLeads', 'leads', 'kpi', 'Total histórico de leads capturados', 'vendedores'),
  ('kpi.tasa_conversion', 'Tasa de conversión', 'WidgetsKpiTasaConversion', 'leads', 'kpi', '% de leads cerrados que terminaron ganados', 'vendedores'),
  ('kpi.leads_ganados', 'Leads ganados', 'WidgetsKpiLeadsGanados', 'leads', 'kpi', 'Cantidad de leads cerrados como venta', 'vendedores'),
  ('chart.leads_tendencia', 'Leads captados (30 días)', 'WidgetsChartLeadsTendencia', 'leads', 'chart', 'Leads creados vs. ganados por día, últimos 30 días', 'vendedores'),
  ('chart.leads_por_estado', 'Leads y sus estados', 'WidgetsChartLeadsPorEstado', 'leads', 'chart', 'Distribución de leads propios por estado del pipeline', 'vendedores'),
  ('tabla.lead_management', 'Lead management', 'WidgetsTablaLeadManagement', 'leads', 'tabla', 'Tabla de leads con búsqueda por nombre', 'vendedores')
on conflict (key) do nothing;
