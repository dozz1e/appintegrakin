-- Permite eliminar interacciones de clientes/leads (solo quien las creó) y
-- tareas/recordatorios (mismo criterio que update_tareas: dueño o con
-- permiso tareas.view_all). Sin estas políticas, el delete queda bloqueado
-- por RLS aunque el frontend tenga el botón.

create policy delete_interacciones_propias_cliente
  on cliente_interacciones for delete
  using (created_by = auth.uid());

create policy delete_interacciones_propias_lead
  on lead_interacciones for delete
  using (created_by = auth.uid());

create policy delete_tareas
  on tareas for delete
  using (owner_id = auth.uid() or has_permission(auth.uid(), 'tareas', 'view_all'));
