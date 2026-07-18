-- Vendedores no ven tickets (no tienen permiso sobre el recurso). El widget
-- de performance por vendedor no debería mostrar esa métrica.

drop view vista_performance_vendedores;

create view vista_performance_vendedores
with (security_invoker = true) as
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
