-- El widget "Leads por estado" (chart.leads_por_estado) queda redundante
-- con el nuevo embudo de leads (chart.funnel_leads, rediseñado como
-- embudo real con % de conversión) - pedido del usuario de sacarlo del
-- catálogo. on delete cascade en user_dashboard_widgets.widget_id se
-- encarga de limpiar las asignaciones existentes de cualquier usuario.

delete from dashboard_widgets where key = 'chart.leads_por_estado';
