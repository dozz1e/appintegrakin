-- 20260722230000_widgets_post_venta_rediseno_charts.sql
--
-- Tercera y última tanda del rediseño de charts (ver 20260722220000
-- vendedores, 20260722223000 lider_venta). Mismo criterio: mismas keys,
-- componentes nuevos, sin reasignar salvo el widget nuevo.

update dashboard_widgets set
  label = 'Embudo del pipeline técnico',
  component = 'WidgetsChartEmbudoPostVenta',
  descripcion = 'Tickets que alcanzaron cada paso del pipeline técnico en algún momento, ordenado por secuencia real (no por conteo)'
where key = 'chart.post_venta_por_estado' and dashboard = 'post_venta';

update dashboard_widgets set
  label = 'Ingresos vs. despachos',
  component = 'WidgetsChartPostVentaIngresosDespachos',
  descripcion = 'Tickets ingresados vs. despachados por día (2 series, antes eran 7 - una por estado)'
where key = 'chart.post_venta_tendencia' and dashboard = 'post_venta';

insert into dashboard_widgets (key, label, component, resource, tipo, descripcion, dashboard) values
  ('card.tickets_vencidos', 'Tickets vencidos', 'WidgetsTicketsVencidos', 'tickets_post_venta', 'chart', 'Tickets activos con fecha tope vencida, listado directo (el KPI solo da el conteo)', 'post_venta')
on conflict (key) do nothing;

-- Asignar el widget nuevo a quien ya tenga el dashboard post_venta completo
-- (mismo criterio que en las dos tandas anteriores: usar un widget existente
-- del set completo como proxy - acá tabla.post_venta_management).
insert into user_dashboard_widgets (user_id, widget_id, orden)
select udw.user_id, nuevo.id, udw.orden + 1
from user_dashboard_widgets udw
join dashboard_widgets dw on dw.id = udw.widget_id and dw.key = 'tabla.post_venta_management' and dw.dashboard = 'post_venta'
join dashboard_widgets nuevo on nuevo.key = 'card.tickets_vencidos' and nuevo.dashboard = 'post_venta'
on conflict (user_id, widget_id) do nothing;
