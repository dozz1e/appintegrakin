-- Relación muchos a muchos entre tickets de servicio técnico y los
-- productos que el cliente compró y que se vinculan al ticket (ver
-- docs/superpowers/specs/2026-07-16-ventas-editar-eliminar-ticket-productos-design.md).
-- Mismo patrón de RLS en cascada que entidad_imagenes
-- (20260716020000_entidad_imagenes.sql): la condición reusa las reglas
-- de tickets_select/tickets_update (20260702000300_rls_policies.sql)
-- contra la fila padre. Sin trigger de auditoría (no es una entidad de
-- negocio en sí misma, igual criterio que entidad_imagenes).

create table ticket_productos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  producto_id uuid not null references productos(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (ticket_id, producto_id)
);

create index idx_ticket_productos_ticket on ticket_productos(ticket_id);

alter table ticket_productos enable row level security;

create policy ticket_productos_select on ticket_productos for select using (
  exists (
    select 1 from tickets t where t.id = ticket_productos.ticket_id
    and (
      has_permission(auth.uid(), 'tickets', 'view_all')
      or (has_permission(auth.uid(), 'tickets', 'view') and t.owner_id = auth.uid())
    )
  )
);

create policy ticket_productos_insert on ticket_productos for insert with check (
  has_permission(auth.uid(), 'tickets', 'edit')
  and exists (
    select 1 from tickets t where t.id = ticket_productos.ticket_id
    and (has_permission(auth.uid(), 'tickets', 'view_all') or t.owner_id = auth.uid())
  )
);

create policy ticket_productos_delete on ticket_productos for delete using (
  has_permission(auth.uid(), 'tickets', 'edit')
  and exists (
    select 1 from tickets t where t.id = ticket_productos.ticket_id
    and (has_permission(auth.uid(), 'tickets', 'view_all') or t.owner_id = auth.uid())
  )
);
