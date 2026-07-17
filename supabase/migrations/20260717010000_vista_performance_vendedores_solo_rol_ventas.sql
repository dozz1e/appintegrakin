-- vista_performance_vendedores (creada a mano en el SQL Editor, sin
-- migración previa - ver nota de CONTEXTO_PROYECTO.md sobre migraciones
-- iniciales creadas fuera de archivo) traía TODOS los profiles activos
-- (dueña, técnicos, etc.), no solo vendedores. El widget "Performance
-- por vendedor" del dashboard debe mostrar únicamente a quienes tienen
-- el rol ventas (hoy: Carla Bolivar, Natalia Quevedo, Romina Espinoza),
-- mismo criterio que el selector de vendedor en /leads
-- (fetchUsuariosPorRol('ventas')).

create or replace view vista_performance_vendedores
with (security_invoker = true) as
select
  p.id as vendedor_id,
  p.full_name,
  (select count(*) from leads l where l.owner_id = p.id) as leads_total,
  (select count(*) from leads l where l.owner_id = p.id and l.estado = 'ganado') as leads_ganados,
  (select count(*) from leads l where l.owner_id = p.id and l.estado = 'perdido') as leads_perdidos,
  (select count(*) from tickets t where t.owner_id = p.id) as tickets_total,
  (select count(*) from tickets t where t.owner_id = p.id and t.estado in ('resuelto', 'cerrado')) as tickets_resueltos
from profiles p
where p.active = true
  and exists (
    select 1 from profile_roles pr
    join roles r on r.id = pr.role_id
    where pr.profile_id = p.id and r.name = 'ventas'
  );
