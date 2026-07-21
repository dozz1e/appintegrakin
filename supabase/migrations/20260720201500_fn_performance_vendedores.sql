-- supabase/migrations/20260720201500_fn_performance_vendedores.sql
--
-- vista_performance_vendedores (security_invoker) filtra vendedoras con un
-- EXISTS sobre profile_roles y cuenta leads propios de cada una. Con RLS
-- de invoker, un usuario de rol ventas solo puede leer su propia fila de
-- profile_roles y sus propios leads (has_permission 'view', no 'view_all'),
-- así que el gráfico "Performance por vendedor" solo mostraba a la
-- vendedora logueada, no a las 3.
--
-- En vez de abrir profile_roles/leads a todo el rol ventas (filtraría
-- también otras pantallas que usan esas tablas), se reemplaza la vista por
-- un RPC security definer que solo expone los conteos agregados -mismo
-- patrón que fn_conteo_tickets_cliente- y valida a mano el permiso
-- reportes.view_all antes de calcular.

create or replace function fn_performance_vendedores()
returns table(
  vendedor_id uuid,
  full_name text,
  leads_total bigint,
  leads_ganados bigint,
  leads_perdidos bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission(auth.uid(), 'reportes', 'view_all') then
    raise exception 'Sin permiso para ver performance de vendedores';
  end if;

  return query
    select
      p.id as vendedor_id,
      p.full_name,
      (select count(*) from leads l where l.owner_id = p.id) as leads_total,
      (select count(*) from leads l where l.owner_id = p.id and l.estado = 'ganado') as leads_ganados,
      (select count(*) from leads l where l.owner_id = p.id and l.estado = 'perdido') as leads_perdidos
    from profiles p
    where p.active = true
      and exists (
        select 1 from profile_roles pr
        join roles r on r.id = pr.role_id
        where pr.profile_id = p.id and r.name = 'ventas'
      );
end;
$$;

revoke execute on function fn_performance_vendedores() from public, anon;
grant execute on function fn_performance_vendedores() to authenticated;

drop view vista_performance_vendedores;
