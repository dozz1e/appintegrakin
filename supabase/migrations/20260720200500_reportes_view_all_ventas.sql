-- supabase/migrations/20260720200500_reportes_view_all_ventas.sql
--
-- Widget "Performance por vendedor" (chart.performance_vendedores) ya está
-- asignado a varios usuarios de rol ventas (Carla, Natalia, Romina), pero
-- el componente exige el permiso reportes.view_all y solo el rol dueña lo
-- tenía, así que el widget les quedaba en blanco. Se otorga a rol ventas.

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.name = 'ventas'
  and p.resource = 'reportes'
  and p.action = 'view_all'
on conflict do nothing;
