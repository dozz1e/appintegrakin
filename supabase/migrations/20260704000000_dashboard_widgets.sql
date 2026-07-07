-- 20260704000000_dashboard_widgets.sql
--
-- Sistema de dashboards por widgets, por usuario. A propósito NO reutiliza
-- features/user_features (ese sistema es exclusivo del superadmin y oculto
-- incluso para la dueña). Este otro se apoya en el RBAC normal: la dueña
-- recibe el permiso 'dashboard_widgets.assign' como cualquier permiso de su
-- rol, y el superadmin sigue con su bypass automático en has_permission().

create table dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,        -- 'kpi.leads_activos', 'chart.leads_por_estado'
  label text not null,
  component text not null,         -- nombre exacto del componente Nuxt autoregistrado
                                    -- ej. 'WidgetsKpiLeadsActivos'
  tipo text check (tipo in ('kpi','chart')) not null,
  descripcion text,
  created_at timestamptz default now()
);

create table user_dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  widget_id uuid references dashboard_widgets(id) on delete cascade,
  orden int default 0,
  config jsonb default '{}'::jsonb,   -- ajustes puntuales del widget para ese usuario
  granted_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(user_id, widget_id)
);

alter table dashboard_widgets enable row level security;
alter table user_dashboard_widgets enable row level security;

-- Catálogo: lo ve quien puede asignar (dueña, superadmin vía bypass)
create policy dashboard_widgets_select on dashboard_widgets
for select using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));

create policy dashboard_widgets_write on dashboard_widgets
for all using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));

-- Asignaciones: cada uno ve las suyas, o todas si puede ver_all/asignar
create policy user_dashboard_widgets_select on user_dashboard_widgets
for select using (
  user_id = auth.uid()
  or has_permission(auth.uid(), 'dashboard_widgets', 'view_all')
  or has_permission(auth.uid(), 'dashboard_widgets', 'assign')
);

create policy user_dashboard_widgets_write on user_dashboard_widgets
for all using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));

-- RPC: widgets activos del usuario actual, en su orden. security definer para
-- que un usuario normal (sin permiso sobre dashboard_widgets) pueda leer los
-- SUYOS sin necesitar select directo sobre las tablas.
create or replace function mis_widgets()
returns table (key text, label text, component text, tipo text, orden int, config jsonb)
language sql
security definer
stable
as $$
  select w.key, w.label, w.component, w.tipo, udw.orden, udw.config
  from user_dashboard_widgets udw
  join dashboard_widgets w on w.id = udw.widget_id
  where udw.user_id = auth.uid()
  order by udw.orden;
$$;

-- Nuevos permisos + se los damos a la dueña
insert into permissions (resource, action) values
  ('dashboard_widgets', 'view_all'),
  ('dashboard_widgets', 'assign')
on conflict (resource, action) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.name = 'dueña'
  and p.resource = 'dashboard_widgets'
  and p.action in ('view_all', 'assign')
on conflict do nothing;

-- Catálogo inicial - agrega más filas acá a medida que crees componentes nuevos
insert into dashboard_widgets (key, label, component, tipo, descripcion) values
  ('kpi.leads_activos', 'Leads activos', 'WidgetsKpiLeadsActivos', 'kpi', 'Cantidad de leads sin cerrar'),
  ('kpi.tickets_abiertos', 'Tickets abiertos', 'WidgetsKpiTicketsAbiertos', 'kpi', 'Tickets no cerrados'),
  ('kpi.clientes_totales', 'Clientes totales', 'WidgetsKpiClientesTotales', 'kpi', 'Total de clientes registrados'),
  ('chart.leads_por_estado', 'Leads por estado', 'WidgetsChartLeadsPorEstado', 'chart', 'Distribución del pipeline de leads')
on conflict (key) do nothing;
