-- 20260721084645_vaciar_catalogo_dashboard_widgets.sql
-- Se rehacen desde cero las cards/gráficas del dashboard personal. Se borra
-- el catálogo completo de widgets (cascada elimina también las asignaciones
-- en user_dashboard_widgets vía FK on delete cascade). El sistema de
-- asignación en sí (tablas, RPCs, permisos, panel admin/dashboards) queda
-- intacto - solo vacío, listo para widgets nuevos.

delete from dashboard_widgets;
