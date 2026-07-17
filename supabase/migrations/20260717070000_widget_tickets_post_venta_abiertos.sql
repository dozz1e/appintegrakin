-- Pedido del usuario: no había dashboard/widget para tickets_post_venta -
-- solo existía kpi.tickets_abiertos, que cuenta la tabla `tickets`
-- (servicio técnico). Se agrega el KPI espejo para post-venta y se
-- renombra el existente para que quede claro cuál es cuál al asignar
-- widgets desde /admin/dashboards.

update dashboard_widgets
set label = 'Tickets abiertos (Servicio técnico)'
where key = 'kpi.tickets_abiertos';

insert into dashboard_widgets (key, label, component, resource, tipo, descripcion)
values (
  'kpi.tickets_post_venta_abiertos',
  'Tickets abiertos (Post venta)',
  'WidgetsKpiTicketsAbiertosPostVenta',
  'tickets_post_venta',
  'kpi',
  'Tickets de post-venta sin despachar'
)
on conflict (key) do nothing;
