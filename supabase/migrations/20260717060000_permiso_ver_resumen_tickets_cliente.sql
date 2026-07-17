-- Pedido del usuario: los cards de Total/Abiertos/Resueltos en la ficha de
-- cliente (fn_conteo_tickets_cliente, ver migración anterior) hoy los ve
-- cualquiera que pueda ver al cliente, sin forma de revocárselo a alguien
-- puntual. Se agrega un permiso propio, clientes.view_tickets_resumen, y se
-- otorga por defecto a todos los roles que hoy tienen clientes.view o
-- clientes.view_all (para no cambiar el comportamiento actual de nadie) -
-- la dueña puede sacárselo a un usuario puntual desde /admin/permisos.

insert into permissions (resource, action)
values ('clientes', 'view_tickets_resumen')
on conflict (resource, action) do nothing;

insert into role_permissions (role_id, permission_id)
select rp.role_id, perm.id
from role_permissions rp
join permissions p on p.id = rp.permission_id and p.resource = 'clientes' and p.action in ('view', 'view_all')
join permissions perm on perm.resource = 'clientes' and perm.action = 'view_tickets_resumen'
on conflict do nothing;

create or replace function fn_conteo_tickets_cliente(p_cliente_id uuid)
returns table(total bigint, abiertos bigint, resueltos bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission(auth.uid(), 'clientes', 'view_tickets_resumen') then
    raise exception 'Sin permiso para ver el resumen de tickets';
  end if;

  if not exists (
    select 1 from clientes c
    where c.id = p_cliente_id
      and (
        has_permission(auth.uid(), 'clientes', 'view_all')
        or (has_permission(auth.uid(), 'clientes', 'view') and c.owner_id = auth.uid())
      )
  ) then
    raise exception 'Sin permiso para ver este cliente';
  end if;

  return query
    select
      count(*) as total,
      count(*) filter (where t.estado <> 'cerrado') as abiertos,
      count(*) filter (where t.estado = 'resuelto') as resueltos
    from tickets t
    where t.cliente_id = p_cliente_id;
end;
$$;
