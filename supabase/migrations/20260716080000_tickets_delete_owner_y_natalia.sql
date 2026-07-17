-- Pedido del usuario (jul 16): tickets de servicio técnico deben poder
-- ser eliminados por su dueño (owner_id), por Natalia Quevedo, por
-- Jennifer Espinoza (dueña) y por el superadmin.
--
-- Jennifer ya tiene tickets.delete vía el rol "dueña"
-- (20260702000600_seed_roles_permisos.sql) y el superadmin ya bypasea
-- todo vía has_permission() (ver gotcha #15 de CONTEXTO_PROYECTO.md) -
-- ninguno de los dos necesita cambios. Faltaban dos cosas:
--
-- 1. El dueño de un ticket (owner_id = auth.uid()) no podía borrar su
--    propio ticket a menos que tuviera el permiso tickets.delete (solo
--    dueña lo tiene por defecto) - se agrega como condición extra en la
--    policy, sin tocar el permiso en sí.
-- 2. Natalia tiene roles capacitaciones/post_venta/servicio_tecnico/
--    ventas, ninguno con tickets.delete (servicio_tecnico solo da
--    view/create/edit) - se agrega como override individual, mismo
--    patrón que su override de ventas.view_all
--    (2026-07-16-natalia-permisos-filtro-leads-design.md), no un rol
--    nuevo.

drop policy tickets_delete on tickets;

create policy tickets_delete on tickets
for delete using (
  has_permission(auth.uid(), 'tickets', 'delete')
  or owner_id = auth.uid()
);

insert into user_permission_overrides (user_id, permission_id, effect, created_by)
select p.id, perm.id, 'grant', null
from profiles p, permissions perm
where p.email = 'n.quevedo@integrakin.cl'
  and perm.resource = 'tickets' and perm.action = 'delete'
on conflict (user_id, permission_id) do nothing;
