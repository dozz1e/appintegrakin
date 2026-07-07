// composables/useErrorLog.ts
// Solo funciona para superadmin - RLS de error_log no le da select a nadie más.

export interface ErrorLogEntry {
  id: string
  user_id: string | null
  mensaje: string
  ruta: string | null
  contexto: Record<string, unknown> | null
  created_at: string
}

export const useErrorLog = () => {
  const supabase = useSupabaseClient()

  const fetchErrores = async (limite = 50) => {
    const { data, error } = await supabase
      .from('error_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limite)
    if (error) throw error
    return data as ErrorLogEntry[]
  }

  return { fetchErrores }
}
