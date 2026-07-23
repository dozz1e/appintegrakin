-- 20260722223000_widgets_lider_venta_rediseno_charts.sql
--
-- Segunda tanda del rediseño de charts (ver 20260722220000 para vendedores).
-- Mismo criterio: mismas keys, componentes nuevos, sin reasignar en
-- user_dashboard_widgets salvo para el widget nuevo.
--
-- chart.leads_tendencia_lider y chart.leads_por_estado_lider reutilizan los
-- MISMOS componentes ya creados para 'vendedores' (WidgetsChartLeadsCaptadosPorDia,
-- WidgetsChartEmbudoLeads) - igual que ya hacía chart.clientes_tendencia_vendedores
-- con WidgetsChartClientesTendencia: el RLS de leads/clientes (view_all OR
-- (view AND owner=self)) hace que el mismo componente muestre datos
-- team-wide automáticamente para quien tenga view_all.

update dashboard_widgets set
  component = 'WidgetsChartClientesPorVendedor',
  descripcion = 'Ranking de clientes captados por vendedor en el período (reemplaza la línea por vendedor, ilegible con equipo grande)'
where key = 'chart.clientes_tendencia_vendedores' and dashboard = 'lider_venta';

update dashboard_widgets set
  component = 'WidgetsChartLeadsCaptadosPorDia',
  descripcion = 'Leads creados por día (team-wide), sin desglose por estado'
where key = 'chart.leads_tendencia_lider' and dashboard = 'lider_venta';

update dashboard_widgets set
  label = 'Embudo de conversión (equipo)',
  component = 'WidgetsChartEmbudoLeads',
  descripcion = 'Leads del equipo que alcanzaron cada etapa del pipeline en algún momento'
where key = 'chart.leads_por_estado_lider' and dashboard = 'lider_venta';

insert into dashboard_widgets (key, label, component, resource, tipo, descripcion, dashboard) values
  ('card.vendedores_estancados', 'Vendedores con leads estancados', 'WidgetsVendedoresEstancados', 'leads', 'chart', 'Vendedores con leads activos sin movimiento hace 3+ días', 'lider_venta')
on conflict (key) do nothing;

-- Asignar el widget nuevo a quien ya tenga el dashboard lider_venta completo
-- (mismo criterio que en 20260722220000: usar un widget existente del set
-- completo como proxy - acá chart.performance_vendedores, exclusivo de
-- lider_venta y no asignado a usuarios con dashboard parcial/de prueba).
insert into user_dashboard_widgets (user_id, widget_id, orden)
select udw.user_id, nuevo.id, udw.orden + 1
from user_dashboard_widgets udw
join dashboard_widgets dw on dw.id = udw.widget_id and dw.key = 'chart.performance_vendedores' and dw.dashboard = 'lider_venta'
join dashboard_widgets nuevo on nuevo.key = 'card.vendedores_estancados' and nuevo.dashboard = 'lider_venta'
on conflict (user_id, widget_id) do nothing;
