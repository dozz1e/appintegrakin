-- Los cards de resumen (Total/Abiertos/Resueltos) en la ficha de cliente
-- deben verlos todos los que ven al cliente, no solo quien tiene permiso
-- sobre 'tickets' (tickets_select exige tickets.view/view_all, lo que
-- dejaba los cards en 0 para vendedores sin ese permiso). RPC security
-- definer que solo expone el conteo, no las filas de tickets, y valida
-- a mano que el caller pueda ver ese cliente (mismo criterio que
-- clientes_select) antes de contar.

create or replace function fn_conteo_tickets_cliente(p_cliente_id uuid)
returns table(total bigint, abiertos bigint, resueltos bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
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

revoke execute on function fn_conteo_tickets_cliente(uuid) from public, anon;
grant execute on function fn_conteo_tickets_cliente(uuid) to authenticated;
