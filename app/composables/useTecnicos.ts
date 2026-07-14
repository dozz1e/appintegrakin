// composables/useTecnicos.ts
// Lectura de técnicos de servicio: no tienen cuenta ni login, solo se usan
// para asignar tickets (ver migración 20260713000600_tecnicos.sql).

export interface Tecnico {
  id: string
  nombre: string
  activo: boolean
}

export const useTecnicos = () => {
  const supabase = useSupabaseClient()

  const fetchTecnicos = async () => {
    const { data, error } = await supabase
      .from('tecnicos')
      .select('id, nombre, activo')
      .eq('activo', true)
      .order('nombre')
    if (error) throw error
    return data as Tecnico[]
  }

  return { fetchTecnicos }
}
