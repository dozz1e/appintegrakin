-- RLS: RBAC + ReBAC. Patrón idéntico en las tres tablas:
--   view_all -> ve todo | view (sin view_all) -> solo lo propio (owner_id)

alter table clientes enable row level security;
alter table leads enable row level security;
alter table tickets enable row level security;

-- CLIENTES
create policy clientes_select on clientes
for select using (
  has_permission(auth.uid(), 'clientes', 'view_all')
  or (has_permission(auth.uid(), 'clientes', 'view') and owner_id = auth.uid())
);

create policy clientes_insert on clientes
for insert with check (has_permission(auth.uid(), 'clientes', 'create'));

create policy clientes_update on clientes
for update using (
  has_permission(auth.uid(), 'clientes', 'edit')
  and (has_permission(auth.uid(), 'clientes', 'view_all') or owner_id = auth.uid())
);

create policy clientes_delete on clientes
for delete using (has_permission(auth.uid(), 'clientes', 'delete'));

-- LEADS
create policy leads_select on leads
for select using (
  has_permission(auth.uid(), 'leads', 'view_all')
  or (has_permission(auth.uid(), 'leads', 'view') and owner_id = auth.uid())
);

create policy leads_insert on leads
for insert with check (has_permission(auth.uid(), 'leads', 'create'));

create policy leads_update on leads
for update using (
  has_permission(auth.uid(), 'leads', 'edit')
  and (has_permission(auth.uid(), 'leads', 'view_all') or owner_id = auth.uid())
);

create policy leads_delete on leads
for delete using (has_permission(auth.uid(), 'leads', 'delete'));

-- TICKETS
create policy tickets_select on tickets
for select using (
  has_permission(auth.uid(), 'tickets', 'view_all')
  or (has_permission(auth.uid(), 'tickets', 'view') and owner_id = auth.uid())
);

create policy tickets_insert on tickets
for insert with check (has_permission(auth.uid(), 'tickets', 'create'));

create policy tickets_update on tickets
for update using (
  has_permission(auth.uid(), 'tickets', 'edit')
  and (has_permission(auth.uid(), 'tickets', 'view_all') or owner_id = auth.uid())
);

create policy tickets_delete on tickets
for delete using (has_permission(auth.uid(), 'tickets', 'delete'));
