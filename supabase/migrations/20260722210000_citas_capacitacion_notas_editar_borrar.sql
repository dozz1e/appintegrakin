-- supabase/migrations/20260722210000_citas_capacitacion_notas_editar_borrar.sql
--
-- Permite editar/eliminar anotaciones de capacitación (antes solo
-- crear/leer). Mismo criterio que update_citas_capacitacion: quien
-- escribió la nota, o quien tiene visibilidad total del módulo.

create policy update_citas_capacitacion_notas
  on citas_capacitacion_notas for update
  using (created_by = auth.uid() or has_permission(auth.uid(), 'capacitaciones', 'view_all'));

create policy delete_citas_capacitacion_notas
  on citas_capacitacion_notas for delete
  using (created_by = auth.uid() or has_permission(auth.uid(), 'capacitaciones', 'view_all'));
