// composables/useAuditoria.ts

export interface AuditoriaEntry {
  id: string
  tabla: string
  registro_id: string
  usuario_id: string | null
  accion: 'insert' | 'update' | 'delete'
  datos_anteriores: Record<string, unknown> | null
  datos_nuevos: Record<string, unknown> | null
  created_at: string
  usuario?: { full_name: string | null; email: string | null } | null
}

export interface AuditoriaFiltros {
  usuarioId?: string
  tabla?: string
  accion?: 'insert' | 'update' | 'delete'
  desde?: string  // 'YYYY-MM-DD'
  hasta?: string  // 'YYYY-MM-DD'
}

const TAMANO_PAGINA = 30

export const useAuditoria = () => {
  const supabase = useSupabaseClient()

  const fetchAuditoria = async (filtros: AuditoriaFiltros = {}, pagina = 0) => {
    let query = supabase
      .from('audit_log')
      .select('*, usuario:profiles!audit_log_usuario_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })

    if (filtros.usuarioId) query = query.eq('usuario_id', filtros.usuarioId)
    if (filtros.tabla) query = query.eq('tabla', filtros.tabla)
    if (filtros.accion) query = query.eq('accion', filtros.accion)
    if (filtros.desde) query = query.gte('created_at', `${filtros.desde}T00:00:00`)
    if (filtros.hasta) query = query.lte('created_at', `${filtros.hasta}T23:59:59`)

    const inicio = pagina * TAMANO_PAGINA
    const fin = inicio + TAMANO_PAGINA
    const { data, error } = await query.range(inicio, fin)
    if (error) throw error

    const filas = data as unknown as AuditoriaEntry[]
    const hasMore = filas.length > TAMANO_PAGINA
    return { registros: hasMore ? filas.slice(0, TAMANO_PAGINA) : filas, hasMore }
  }

  return { fetchAuditoria }
}
