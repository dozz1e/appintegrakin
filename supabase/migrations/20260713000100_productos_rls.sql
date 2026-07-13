-- Sin distinción propio/todos (no hay owner_id): view y view_all se
-- comportan igual, ambos ven el catálogo completo. Se mantienen como
-- permisos separados por consistencia con el resto de recursos del
-- sistema de permisos (RBAC ya asume ese par view/view_all en la UI).

alter table productos enable row level security;

create policy productos_select on productos
for select using (
  has_permission(auth.uid(), 'productos', 'view_all')
  or has_permission(auth.uid(), 'productos', 'view')
);

create policy productos_insert on productos
for insert with check (has_permission(auth.uid(), 'productos', 'create'));

create policy productos_update on productos
for update using (has_permission(auth.uid(), 'productos', 'edit'));

create policy productos_delete on productos
for delete using (has_permission(auth.uid(), 'productos', 'delete'));
