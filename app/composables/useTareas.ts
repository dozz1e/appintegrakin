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
const STORAGE_KEY_DESCARTADAS = 'tareas-proximas-descartadas'

function guardarDescartadasEnStorage(ids: Set<string>): void {
  if (!import.meta.client) return
  localStorage.setItem(STORAGE_KEY_DESCARTADAS, JSON.stringify([...ids]))
}

export function useTareas() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { error: toastError } = useToast()

  // Estado compartido para el alert global de "tarea próxima a vencer"
  // (RecordatorioAlertContainer.vue) - mismo patrón que useToast.ts.
  const tareasProximas = useState<Tarea[]>('tareas-proximas', () => [])
  // Vacío en SSR/hydration (useState no puede leer localStorage al inicializar);
  // se puebla desde localStorage vía cargarDescartadasGuardadas() en el
  // onMounted del container, client-only.
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
  // completadas, a UMBRAL_MINUTOS_PROXIMAS o menos de vencer, o ya vencidas
  // (sin límite hacia atrás - se van solas al marcarse completadas),
  // excluyendo las que el usuario ya cerró (idsTareasDescartadas).
  async function refrescarTareasProximas(): Promise<void> {
    const pendientes = await fetchMisTareasPendientes()
    const ahora = Date.now()
    tareasProximas.value = pendientes.filter((t) => {
      if (!t.fecha_vencimiento || idsTareasDescartadas.value.has(t.id)) return false
      const msRestante = new Date(t.fecha_vencimiento).getTime() - ahora
      return msRestante <= UMBRAL_MINUTOS_PROXIMAS * 60_000
    })

    // Poda: si una tarea descartada ya no está pendiente (se completó o
    // se eliminó), se saca del set guardado para no acumular ids muertos.
    const idsPendientes = new Set(pendientes.map((t) => t.id))
    let podado = false
    for (const id of idsTareasDescartadas.value) {
      if (!idsPendientes.has(id)) {
        idsTareasDescartadas.value.delete(id)
        podado = true
      }
    }
    if (podado) guardarDescartadasEnStorage(idsTareasDescartadas.value)
  }

  // Cierre de un alert individual (botón ✕). Persiste en localStorage: la
  // tarea sigue oculta entre sesiones/recargas hasta que se complete (ver
  // poda en refrescarTareasProximas).
  function descartarTareaProxima(id: string): void {
    idsTareasDescartadas.value.add(id)
    tareasProximas.value = tareasProximas.value.filter((t) => t.id !== id)
    guardarDescartadasEnStorage(idsTareasDescartadas.value)
  }

  // Client-only: puebla idsTareasDescartadas desde localStorage. Se llama
  // una vez en el onMounted del container, antes del primer refrescar.
  function cargarDescartadasGuardadas(): void {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DESCARTADAS)
      if (raw) idsTareasDescartadas.value = new Set(JSON.parse(raw))
    } catch {
      // localStorage corrupto o inaccesible - se sigue sin descartes previos
    }
  }

  return {
    fetchTareasPorEntidad,
    fetchMisTareasPendientes,
    crearTarea,
    marcarCompletada,
    tareasProximas,
    refrescarTareasProximas,
    descartarTareaProxima,
    cargarDescartadasGuardadas,
  }
}