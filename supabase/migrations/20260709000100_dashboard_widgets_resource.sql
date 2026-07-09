-- supabase/migrations/20260709000100_dashboard_widgets_resource.sql
--
-- Acopla el catálogo de dashboard_widgets al sistema de permisos: cada
-- widget declara a qué resource pertenece, para poder filtrar tanto al
-- asignarlo (admin/dashboards, Task 4) como al renderizarlo en el
-- dashboard propio del usuario (index.vue, Task 5).

alter table dashboard_widgets add column resource text;

update dashboard_widgets set resource = 'leads'    where key = 'kpi.leads_activos';
update dashboard_widgets set resource = 'tickets'  where key = 'kpi.tickets_abiertos';
update dashboard_widgets set resource = 'clientes' where key = 'kpi.clientes_totales';
update dashboard_widgets set resource = 'leads'    where key = 'chart.leads_por_estado';
update dashboard_widgets set resource = 'leads'    where key = 'kpi.tasa_conversion';

alter table dashboard_widgets alter column resource set not null;

drop function mis_widgets();

create function mis_widgets()
returns table (key text, label text, component text, resource text, tipo text, orden int, config jsonb)
language sql
security definer
stable
as $$
  select w.key, w.label, w.component, w.resource, w.tipo, udw.orden, udw.config
  from user_dashboard_widgets udw
  join dashboard_widgets w on w.id = udw.widget_id
  where udw.user_id = auth.uid()
  order by udw.orden;
$$;
