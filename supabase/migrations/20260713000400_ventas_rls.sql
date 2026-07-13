-- Mismo patrón que tickets (20260702000300_rls_policies.sql:47-63):
-- owner_id distingue "propias" de "todas" - sin política de assign,
-- no aplica reasignar una venta a otro vendedor.

alter table ventas enable row level security;

create policy ventas_select on ventas
for select using (
  has_permission(auth.uid(), 'ventas', 'view_all')
  or (has_permission(auth.uid(), 'ventas', 'view') and owner_id = auth.uid())
);

create policy ventas_insert on ventas
for insert with check (has_permission(auth.uid(), 'ventas', 'create'));

create policy ventas_update on ventas
for update using (
  has_permission(auth.uid(), 'ventas', 'edit')
  and (has_permission(auth.uid(), 'ventas', 'view_all') or owner_id = auth.uid())
);

create policy ventas_delete on ventas
for delete using (has_permission(auth.uid(), 'ventas', 'delete'));
