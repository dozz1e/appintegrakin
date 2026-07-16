-- Agrega fallback de clientes.edit/leads.edit al borrado de interacciones:
-- antes solo quien la creó podía borrarla, así que si otro vendedor o la
-- dueña intentaba borrar una interacción ajena, RLS lo bloqueaba en
-- silencio (0 filas afectadas, sin error) y el frontend mostraba éxito
-- igual. Ver gotcha de delete silencioso por RLS.

drop policy delete_interacciones_propias_cliente on cliente_interacciones;
create policy delete_interacciones_propias_cliente
  on cliente_interacciones for delete
  using (created_by = auth.uid() or has_permission(auth.uid(), 'clientes', 'edit'));

drop policy delete_interacciones_propias_lead on lead_interacciones;
create policy delete_interacciones_propias_lead
  on lead_interacciones for delete
  using (created_by = auth.uid() or has_permission(auth.uid(), 'leads', 'edit'));
