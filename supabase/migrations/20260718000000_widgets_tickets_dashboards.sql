-- Los dashboards standalone /tickets/dashboard y /post-venta/dashboard se
-- eliminan (pedido del usuario: prefiere que todo aparezca en la página de
-- inicio). Su contenido pasa a ser widgets asignables, siguiendo el mismo
-- patrón que kpi.tickets_abiertos / kpi.tickets_post_venta_abiertos.

insert into dashboard_widgets (key, label, component, resource, tipo, descripcion) values
  ('kpi.tickets_total', 'Total tickets (Servicio técnico)', 'WidgetsKpiTicketsTotal', 'tickets', 'kpi', 'Tickets activos + historial, servicio técnico'),
  ('kpi.tickets_resueltos', 'Resueltos (Servicio técnico)', 'WidgetsKpiTicketsResueltos', 'tickets', 'kpi', 'Tickets en estado resuelto'),
  ('kpi.tickets_cerrados', 'Cerrados (Servicio técnico)', 'WidgetsKpiTicketsCerrados', 'tickets', 'kpi', 'Tickets en estado cerrado'),
  ('chart.tickets_por_estado', 'Tickets por estado (Servicio técnico)', 'WidgetsChartTicketsPorEstado', 'tickets', 'chart', 'Distribución por estado'),
  ('chart.tickets_por_prioridad', 'Tickets por prioridad (Servicio técnico)', 'WidgetsChartTicketsPorPrioridad', 'tickets', 'chart', 'Distribución por prioridad, activos'),
  ('chart.tickets_tendencia', 'Tendencia de tickets (Servicio técnico)', 'WidgetsChartTicketsTendencia', 'tickets', 'chart', 'Creados vs cerrados, últimos 30 días'),
  ('kpi.tickets_post_venta_total', 'Total tickets (Post venta)', 'WidgetsKpiTicketsPostVentaTotal', 'tickets_post_venta', 'kpi', 'Tickets activos + historial, post venta'),
  ('kpi.tickets_post_venta_despachados', 'Despachados (Post venta)', 'WidgetsKpiTicketsPostVentaDespachados', 'tickets_post_venta', 'kpi', 'Tickets en estado despachado'),
  ('kpi.tickets_post_venta_vencidos', 'Vencidos (Post venta)', 'WidgetsKpiTicketsPostVentaVencidos', 'tickets_post_venta', 'kpi', 'Tickets activos con fecha tope vencida'),
  ('chart.tickets_post_venta_por_estado', 'Tickets por estado (Post venta)', 'WidgetsChartTicketsPostVentaPorEstado', 'tickets_post_venta', 'chart', 'Distribución por estado'),
  ('chart.tickets_post_venta_vencidos', 'Vencidos vs a tiempo (Post venta)', 'WidgetsChartTicketsPostVentaVencidos', 'tickets_post_venta', 'chart', 'Activos vencidos vs a tiempo'),
  ('chart.tickets_post_venta_tendencia', 'Tendencia de tickets (Post venta)', 'WidgetsChartTicketsPostVentaTendencia', 'tickets_post_venta', 'chart', 'Ingresados vs despachados, últimos 30 días')
on conflict (key) do nothing;
