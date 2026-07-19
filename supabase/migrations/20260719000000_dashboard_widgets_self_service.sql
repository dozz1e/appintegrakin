alter table user_dashboard_widgets
  add column visible boolean not null default true;

create policy user_dashboard_widgets_self_update
  on user_dashboard_widgets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop function mis_widgets();

create function public.mis_widgets()
 returns table(widget_id uuid, key text, label text, component text, resource text, tipo text, orden integer, config jsonb, visible boolean)
 language sql stable security definer
as $function$
  select w.id, w.key, w.label, w.component, w.resource, w.tipo, udw.orden, udw.config, udw.visible
  from user_dashboard_widgets udw
  join dashboard_widgets w on w.id = udw.widget_id
  where udw.user_id = auth.uid()
  order by udw.orden;
$function$;
