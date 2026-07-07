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

export const useAuditoria = () => {
  const supabase = useSupabaseClient()

  const fetchAuditoria = async (limite = 100) => {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*, usuario:profiles!audit_log_usuario_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(limite)
    if (error) throw error
    return data as unknown as AuditoriaEntry[]
  }

  return { fetchAuditoria }
}
