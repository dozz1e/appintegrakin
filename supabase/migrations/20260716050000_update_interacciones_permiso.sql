-- Permite editar interacciones (antes solo crear/borrar). Mismo criterio
-- que la policy de delete ya arreglada: creador o clientes.edit/leads.edit.

create policy update_interacciones_propias_cliente
  on cliente_interacciones for update
  using (created_by = auth.uid() or has_permission(auth.uid(), 'clientes', 'edit'));

create policy update_interacciones_propias_lead
  on lead_interacciones for update
  using (created_by = auth.uid() or has_permission(auth.uid(), 'leads', 'edit'));
