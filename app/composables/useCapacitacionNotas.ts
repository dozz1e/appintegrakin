export interface CapacitacionNota {
  id: string
  cita_id: string
  nota: string
  created_by: string | null
  created_at: string
}

export function useCapacitacionNotas() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  async function fetchNotas(citaId: string): Promise<CapacitacionNota[]> {
    const { data, error } = await supabase
      .from('citas_capacitacion_notas')
      .select('*')
      .eq('cita_id', citaId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  async function agregarNota(citaId: string, nota: string): Promise<CapacitacionNota> {
    const { data, error } = await supabase
      .from('citas_capacitacion_notas')
      .insert({ cita_id: citaId, nota, created_by: user.value?.sub })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function actualizarNota(id: string, nota: string): Promise<CapacitacionNota> {
    const { data, error } = await supabase
      .from('citas_capacitacion_notas')
      .update({ nota })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // .select() para poder verificar filas afectadas: si RLS bloquea el
  // delete, Supabase no tira error (0 filas es un resultado válido).
  async function eliminarNota(id: string): Promise<void> {
    const { data, error } = await supabase.from('citas_capacitacion_notas').delete().eq('id', id).select()
    if (error) throw error
    if (!data?.length) throw new Error('No tenés permiso para eliminar esta anotación')
  }

  return { fetchNotas, agregarNota, actualizarNota, eliminarNota }
}
