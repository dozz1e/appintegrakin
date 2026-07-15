-- supabase/migrations/20260715000000_historial_estados.sql
--
-- Historial de cambios de estado para leads/tickets/tickets_post_venta,
-- tabla genérica (mismo patrón entidad_tipo/entidad_id que notificaciones)
-- en vez de una tabla por módulo. Ver spec
-- 2026-07-15-historial-estados-archivado-design.md.

create table historial_estados (
  id uuid primary key default gen_random_uuid(),
  entidad_tipo text check (entidad_tipo in ('lead', 'ticket', 'ticket_post_venta')) not null,
  entidad_id uuid not null,
  estado_anterior text,
  estado_nuevo text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_historial_estados_entidad on historial_estados(entidad_tipo, entidad_id);

alter table historial_estados enable row level security;

create policy select_historial_estados on historial_estados
for select using (
  (entidad_tipo = 'lead' and (has_permission(auth.uid(), 'leads', 'view') or has_permission(auth.uid(), 'leads', 'view_all')))
  or (entidad_tipo = 'ticket' and (has_permission(auth.uid(), 'tickets', 'view') or has_permission(auth.uid(), 'tickets', 'view_all')))
  or (entidad_tipo = 'ticket_post_venta' and has_permission(auth.uid(), 'tickets_post_venta', 'view'))
);

create or replace function registrar_historial_estado()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.estado is distinct from old.estado then
    insert into historial_estados (entidad_tipo, entidad_id, estado_anterior, estado_nuevo, created_by)
    values (tg_argv[0], new.id, old.estado, new.estado, auth.uid());
  end if;
  return new;
end;
$$;

create trigger historial_estado_leads after update on leads
  for each row execute function registrar_historial_estado('lead');

create trigger historial_estado_tickets after update on tickets
  for each row execute function registrar_historial_estado('ticket');

create trigger historial_estado_tickets_post_venta after update on tickets_post_venta
  for each row execute function registrar_historial_estado('ticket_post_venta');
