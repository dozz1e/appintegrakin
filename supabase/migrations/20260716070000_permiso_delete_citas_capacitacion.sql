-- Agrega el permiso capacitaciones.delete y la policy de delete que
-- faltaba en citas_capacitacion (diseño original solo contemplaba
-- "eliminar" = marcar estado='cancelada', ver
-- 20260714050000_citas_capacitacion.sql). Se pide borrado real desde el
-- calendario/lista de /capacitaciones. Mismo criterio que
-- tickets_post_venta.delete: solo rol "dueña".

insert into permissions (resource, action)
values ('capacitaciones', 'delete')
on conflict (resource, action) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
join permissions p on p.resource = 'capacitaciones' and p.action = 'delete'
where r.name = 'dueña'
on conflict do nothing;

create policy delete_citas_capacitacion on citas_capacitacion
for delete using (has_permission(auth.uid(), 'capacitaciones', 'delete'));
