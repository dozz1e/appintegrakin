-- supabase/migrations/20260709000000_rls_permisos_admin.sql
--
-- permissions, role_permissions y user_permission_overrides tienen RLS
-- activado desde su creación pero sin ninguna política — hoy son
-- inaccesibles desde el cliente (solo se leen vía RPCs security definer
-- como has_permission/permisos_efectivos_usuario). Esta migración las
-- expone para la pantalla /admin/permisos, gateadas por el mismo permiso
-- que ya usa /admin/dashboards.

create policy permissions_select on permissions
for select using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));

create policy role_permissions_select on role_permissions
for select using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));

create policy user_permission_overrides_select on user_permission_overrides
for select using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));

create policy user_permission_overrides_write on user_permission_overrides
for all using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));
