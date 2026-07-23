-- 20260722224500_fn_performance_vendedores_periodo.sql
--
-- Agrega selector de días al widget "Performance por vendedor" (pedido
-- explícito, para que quede consistente con el resto de los charts que ya
-- tienen selector 7/30/90). leads_total pasa a contar leads CREADOS en el
-- período (volumen); leads_ganados/perdidos pasan a contar por fecha_cierre
-- en el período (cuándo se cerraron, no cuándo se crearon) - así un lead
-- viejo que se ganó esta semana sí cuenta como actividad del período.

drop function if exists fn_performance_vendedores();

create or replace function fn_performance_vendedores(dias integer default 30)
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
      (select count(*) from leads l where l.owner_id = p.id and l.created_at >= now() - (dias || ' days')::interval) as leads_total,
      (select count(*) from leads l where l.owner_id = p.id and l.estado = 'ganado' and l.fecha_cierre >= now() - (dias || ' days')::interval) as leads_ganados,
      (select count(*) from leads l where l.owner_id = p.id and l.estado = 'perdido' and l.fecha_cierre >= now() - (dias || ' days')::interval) as leads_perdidos
    from profiles p
    where p.active = true
      and exists (
        select 1 from profile_roles pr
        join roles r on r.id = pr.role_id
        where pr.profile_id = p.id and r.name = 'ventas'
      );
end;
$$;

revoke execute on function fn_performance_vendedores(integer) from public, anon;
grant execute on function fn_performance_vendedores(integer) to authenticated;
