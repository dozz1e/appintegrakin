export interface Tarea {
  id: string
  entidad_tipo: 'lead' | 'cliente' | 'ticket'
  entidad_id: string
  titulo: string
  fecha_vencimiento: string | null
  completada: boolean
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

const UMBRAL_MINUTOS_PROXIMAS = 30

export function useTareas() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { error: toastError } = useToast()

  // Estado compartido para el alert global de "tarea próxima a vencer"
  // (RecordatorioAlertContainer.vue) - mismo patrón que useToast.ts.
  const tareasProximas = useState<Tarea[]>('tareas-proximas', () => [])
  const idsTareasDescartadas = useState<Set<string>>('tareas-proximas-descartadas', () => new Set())

  async function fetchTareasPorEntidad(entidadTipo: Tarea['entidad_tipo'], entidadId: string): Promise<Tarea[]> {
    const { data, error } = await supabase
      .from('tareas')
      .select('*')
      .eq('entidad_tipo', entidadTipo)
      .eq('entidad_id', entidadId)
      .order('completada', { ascending: true })
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })

    if (error) throw error
    return data ?? []
  }

  async function fetchMisTareasPendientes(): Promise<Tarea[]> {
    const { data, error } = await supabase
      .from('tareas')
      .select('*')
      .eq('completada', false)
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })

    if (error) throw error
    return data ?? []
  }

  async function crearTarea(
    entidadTipo: Tarea['entidad_tipo'],
    entidadId: string,
    titulo: string,
    fechaVencimiento: string | null
  ): Promise<Tarea> {
    const { data, error } = await supabase
      .from('tareas')
      .insert({
        entidad_tipo: entidadTipo,
        entidad_id: entidadId,
        titulo,
        fecha_vencimiento: fechaVencimiento,
        owner_id: user.value?.sub,
        created_by: user.value?.sub,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function marcarCompletada(tareaId: string, completada: boolean): Promise<Tarea> {
    const { data, error } = await supabase
      .from('tareas')
      .update({ completada, updated_at: new Date().toISOString() })
      .eq('id', tareaId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Recalcula tareasProximas a partir de fetchMisTareasPendientes: tareas no
  // completadas, con fecha_vencimiento futura pero a UMBRAL_MINUTOS_PROXIMAS
  // o menos, excluyendo las que el usuario ya cerró (idsTareasDescartadas).
  async function refrescarTareasProximas(): Promise<void> {
    const pendientes = await fetchMisTareasPendientes()
    const ahora = Date.now()
    tareasProximas.value = pendientes.filter((t) => {
      if (!t.fecha_vencimiento || idsTareasDescartadas.value.has(t.id)) return false
      const msRestante = new Date(t.fecha_vencimiento).getTime() - ahora
      return msRestante > 0 && msRestante <= UMBRAL_MINUTOS_PROXIMAS * 60_000
    })
  }

  // Cierre de un alert individual (botón ✕). Solo en memoria - se resetea al
  // recargar la página, ver Global Constraints del plan.
  function descartarTareaProxima(id: string): void {
    idsTareasDescartadas.value.add(id)
    tareasProximas.value = tareasProximas.value.filter((t) => t.id !== id)
  }

  return {
    fetchTareasPorEntidad,
    fetchMisTareasPendientes,
    crearTarea,
    marcarCompletada,
    tareasProximas,
    refrescarTareasProximas,
    descartarTareaProxima,
  }
}