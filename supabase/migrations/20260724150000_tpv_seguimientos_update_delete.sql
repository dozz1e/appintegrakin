-- supabase/migrations/20260724150000_tpv_seguimientos_update_delete.sql
--
-- Permite editar y eliminar seguimientos de tickets post-venta
-- (misma condición de permiso que insert).

create policy update_tpv_seguimientos on tickets_post_venta_seguimientos
for update using (
  has_permission(auth.uid(), 'tickets_post_venta', 'edit')
) with check (
  has_permission(auth.uid(), 'tickets_post_venta', 'edit')
);

create policy delete_tpv_seguimientos on tickets_post_venta_seguimientos
for delete using (
  has_permission(auth.uid(), 'tickets_post_venta', 'edit')
);
