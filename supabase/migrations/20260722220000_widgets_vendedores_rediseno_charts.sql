-- 20260722220000_widgets_vendedores_rediseno_charts.sql
--
-- Al usuario no le gustaban los gráficos multi-serie (LineChart de 6 estados,
-- ranking de píldoras sin orden de pipeline). Rediseño del dashboard
-- 'vendedores' acordado por chat: mismas keys, componentes nuevos - así no
-- hay que reasignar nada en user_dashboard_widgets para los dos existentes.

update dashboard_widgets set
  component = 'WidgetsChartLeadsCaptadosPorDia',
  descripcion = 'Leads creados por día, sin desglose por estado'
where key = 'chart.leads_tendencia' and dashboard = 'vendedores';

update dashboard_widgets set
  label = 'Embudo de conversión',
  component = 'WidgetsChartEmbudoLeads',
  descripcion = 'Leads que alcanzaron cada etapa del pipeline en algún momento (no solo dónde están hoy)'
where key = 'chart.leads_por_estado' and dashboard = 'vendedores';

insert into dashboard_widgets (key, label, component, resource, tipo, descripcion, dashboard) values
  ('card.leads_atencion', 'Leads que necesitan atención', 'WidgetsLeadsAtencion', 'leads', 'chart', 'Leads activos con más tiempo sin movimiento', 'vendedores')
on conflict (key) do nothing;

-- Widget nuevo: asignarlo a todos los usuarios que ya tienen el dashboard
-- 'vendedores' completo (los mismos que tienen chart.leads_por_estado), con
-- el siguiente orden disponible.
insert into user_dashboard_widgets (user_id, widget_id, orden)
select udw.user_id, nuevo.id, udw.orden + 1
from user_dashboard_widgets udw
join dashboard_widgets dw on dw.id = udw.widget_id and dw.key = 'chart.leads_por_estado' and dw.dashboard = 'vendedores'
join dashboard_widgets nuevo on nuevo.key = 'card.leads_atencion' and nuevo.dashboard = 'vendedores'
on conflict (user_id, widget_id) do nothing;
