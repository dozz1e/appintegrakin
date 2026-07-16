-- Agrega el permiso tickets_post_venta.delete y lo asigna al rol "dueña",
-- mismo criterio que tickets.delete.

insert into permissions (resource, action)
values ('tickets_post_venta', 'delete')
on conflict (resource, action) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
join permissions p on p.resource = 'tickets_post_venta' and p.action = 'delete'
where r.name = 'dueña'
on conflict do nothing;
