export interface EventoCalendario {
  id: string
  titulo: string
  descripcion: string | null
  fecha_hora: string
  created_by: string | null
  created_at: string
  updated_at: string
  creador_nombre: string
}

function mapearFila(fila: any): EventoCalendario {
  return {
    id: fila.id,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    fecha_hora: fila.fecha_hora,
    created_by: fila.created_by,
    created_at: fila.created_at,
    updated_at: fila.updated_at,
    creador_nombre: fila.creador?.full_name ?? 'Sin nombre',
  }
}

export function useEventosCalendario() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  async function fetchEventos(): Promise<EventoCalendario[]> {
    const { data, error } = await supabase
      .from('eventos_calendario')
      .select('*, creador:profiles!eventos_calendario_created_by_fkey(full_name)')
      .order('fecha_hora', { ascending: true })

    if (error) throw error
    return (data ?? []).map(mapearFila)
  }

  async function crearEvento(payload: { titulo: string; descripcion: string | null; fecha_hora: string }): Promise<void> {
    const { error } = await supabase.from('eventos_calendario').insert({ ...payload, created_by: user.value?.sub })
    if (error) throw error
  }

  async function actualizarEvento(
    id: string,
    payload: Partial<Pick<EventoCalendario, 'titulo' | 'descripcion' | 'fecha_hora'>>
  ): Promise<void> {
    const { error } = await supabase
      .from('eventos_calendario')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }

  async function eliminarEvento(id: string): Promise<void> {
    const { data, error } = await supabase.from('eventos_calendario').delete().eq('id', id).select()
    if (error) throw error
    if (!data?.length) throw new Error('No se pudo eliminar el evento')
  }

  return { fetchEventos, crearEvento, actualizarEvento, eliminarEvento }
}
