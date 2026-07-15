// composables/useHistorialEstados.ts
//
// Historial de cambios de estado, compartido por leads/tickets/
// tickets_post_venta (tabla genérica historial_estados). Ver spec
// 2026-07-15-historial-estados-archivado-design.md.

export type EntidadHistorial = 'lead' | 'ticket' | 'ticket_post_venta'

export interface HistorialEstadoRow {
  id: string
  entidad_id: string
  estado_anterior: string | null
  estado_nuevo: string
  created_at: string
  usuario_nombre: string | null
}

export const useHistorialEstados = () => {
  const supabase = useSupabaseClient()

  const fetchHistorial = async (entidadTipo: EntidadHistorial): Promise<HistorialEstadoRow[]> => {
    const { data, error } = await supabase
      .from('historial_estados')
      .select('id, entidad_id, estado_anterior, estado_nuevo, created_at, usuario:profiles!historial_estados_created_by_fkey(full_name)')
      .eq('entidad_tipo', entidadTipo)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map((fila: any) => ({
      id: fila.id,
      entidad_id: fila.entidad_id,
      estado_anterior: fila.estado_anterior,
      estado_nuevo: fila.estado_nuevo,
      created_at: fila.created_at,
      usuario_nombre: fila.usuario?.full_name ?? null,
    }))
  }

  return { fetchHistorial }
}
