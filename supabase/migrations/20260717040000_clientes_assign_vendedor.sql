-- Pedido del usuario: Natalia, la dueña (Jennifer) y el superadmin deben
-- poder asignar/reasignar el vendedor (owner_id) de cualquier cliente -
-- distinto del filtro de solo lectura que ya existe en /clientes (ver
-- punto 21 del roadmap, CONTEXTO_PROYECTO.md, "Pendientes sueltos").
--
-- clientes_update ya deja editar cualquier campo (incluido owner_id) a
-- quien tenga clientes.edit + (view_all o dueño), pero eso da permiso de
-- editar TODO el cliente (rut, teléfono, etc.), no solo reasignar
-- vendedor, y de paso alcanzaría a cualquier vendedora con el rol
-- "ventas" (Carla/Romina también tienen clientes.edit) sobre sus propios
-- clientes - no es lo pedido. Se agrega un permiso propio, clientes.assign,
-- que en la policy de update actúa como bypass total (puede reasignar
-- cualquier cliente, no solo los propios) - mismo criterio de "admin de
-- confianza" que ya se usó para tickets.delete de Natalia.

insert into permissions (resource, action)
values ('clientes', 'assign')
on conflict (resource, action) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
join permissions p on p.resource = 'clientes' and p.action = 'assign'
where r.name = 'dueña'
on conflict do nothing;

insert into user_permission_overrides (user_id, permission_id, effect, created_by)
select prof.id, perm.id, 'grant', null
from profiles prof, permissions perm
where prof.email = 'n.quevedo@integrakin.cl'
  and perm.resource = 'clientes' and perm.action = 'assign'
on conflict (user_id, permission_id) do nothing;

drop policy clientes_update on clientes;

create policy clientes_update on clientes
for update using (
  has_permission(auth.uid(), 'clientes', 'assign')
  or (
    has_permission(auth.uid(), 'clientes', 'edit')
    and (has_permission(auth.uid(), 'clientes', 'view_all') or owner_id = auth.uid())
  )
);
