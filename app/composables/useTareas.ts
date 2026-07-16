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

import { obtenerUmbralesMinutos, calcularTierActual } from './useUmbralesAlertas'

export function useTareas() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { error: toastError } = useToast()

  // Estado compartido para el alert global de "tarea próxima a vencer"
  // (RecordatorioAlertContainer.vue) - mismo patrón que useToast.ts.
  const tareasProximas = useState<Tarea[]>('tareas-proximas', () => [])
  // Vacío hasta que se puebla desde tareas_descartadas vía
  // cargarDescartadasGuardadas() en el onMounted del container.
  const idsTareasDescartadas = useState<Set<string>>('tareas-proximas-descartadas', () => new Set())
  const tierActualTareas = useState<Map<string, number>>('tareas-proximas-tier', () => new Map())

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

  // "Mis" pendientes = responsable de la tarea, sin importar view_all (ese
  // permiso es para listar tareas de otros, no para que le lluevan alerts
  // ajenos). Mismo criterio de responsable que fn_notificar_tareas_vencidas:
  // owner_id, o created_by si no tiene owner asignado.
  async function fetchMisTareasPendientes(): Promise<Tarea[]> {
    if (!user.value) return []
    const uid = user.value.sub
    const { data, error } = await supabase
      .from('tareas')
      .select('*')
      .eq('completada', false)
      .or(`owner_id.eq.${uid},and(owner_id.is.null,created_by.eq.${uid})`)
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

  async function actualizarTarea(id: string, titulo: string, fechaVencimiento: string | null): Promise<Tarea> {
    const { data, error } = await supabase
      .from('tareas')
      .update({ titulo, fecha_vencimiento: fechaVencimiento, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function eliminarTarea(tareaId: string): Promise<void> {
    const { error } = await supabase.from('tareas').delete().eq('id', tareaId)
    if (error) throw error
  }

  // Recalcula tareasProximas a partir de fetchMisTareasPendientes: tareas no
  // completadas, a UMBRAL_MINUTOS_PROXIMAS o menos de vencer, o ya vencidas
  // (sin límite hacia atrás - se van solas al marcarse completadas),
  // excluyendo las que el usuario ya cerró (idsTareasDescartadas).
  async function refrescarTareasProximas(): Promise<void> {
    const { perfil } = useMiPerfil()
    const umbralesMinutos = obtenerUmbralesMinutos(perfil.value?.settings)

    const pendientes = await fetchMisTareasPendientes()
    const ahora = Date.now()
    const nuevoTier = new Map<string, number>()
    tareasProximas.value = pendientes.filter((t) => {
      if (!t.fecha_vencimiento) return false
      const msRestante = new Date(t.fecha_vencimiento).getTime() - ahora
      const tier = calcularTierActual(msRestante, umbralesMinutos)
      if (tier === null) return false
      nuevoTier.set(t.id, tier)
      return !idsTareasDescartadas.value.has(`${t.id}:${tier}`)
    })
    tierActualTareas.value = nuevoTier

    // Poda: si una tarea descartada ya no está pendiente (se completó o
    // se eliminó), se borran todas sus filas de tareas_descartadas (todos
    // los tiers) para no acumular ids muertos.
    const idsPendientes = new Set(pendientes.map((t) => t.id))
    const idsPodados = new Set<string>()
    for (const clave of idsTareasDescartadas.value) {
      const tareaId = clave.split(':')[0]
      if (!idsPendientes.has(tareaId)) {
        idsTareasDescartadas.value.delete(clave)
        idsPodados.add(tareaId)
      }
    }
    if (idsPodados.size > 0 && user.value) {
      await supabase.from('tareas_descartadas').delete().eq('user_id', user.value.sub).in('tarea_id', [...idsPodados])
    }
  }

  // Cierre de un alert individual (botón ✕). Persiste en tareas_descartadas:
  // la tarea sigue oculta entre sesiones/navegadores/dispositivos hasta que
  // se complete (ver poda en refrescarTareasProximas).
  async function descartarTareaProxima(id: string): Promise<void> {
    const tier = tierActualTareas.value.get(id) ?? 0
    const clave = `${id}:${tier}`
    idsTareasDescartadas.value.add(clave)
    tareasProximas.value = tareasProximas.value.filter((t) => t.id !== id)

    if (!user.value) return
    const { error } = await supabase
      .from('tareas_descartadas')
      .upsert({ user_id: user.value.sub, tarea_id: id, umbral_minutos: tier }, { onConflict: 'user_id,tarea_id,umbral_minutos' })

    if (error) {
      idsTareasDescartadas.value.delete(clave)
      toastError('No se pudo descartar el aviso, intentá de nuevo')
    }
  }

  // Puebla idsTareasDescartadas desde tareas_descartadas. Se llama una vez
  // en el onMounted del container, antes del primer refrescar.
  async function cargarDescartadasGuardadas(): Promise<void> {
    if (!user.value) return
    const { data, error } = await supabase
      .from('tareas_descartadas')
      .select('tarea_id, umbral_minutos')
      .eq('user_id', user.value.sub)

    if (error) return
    idsTareasDescartadas.value = new Set((data ?? []).map((d) => `${d.tarea_id}:${d.umbral_minutos}`))
  }

  return {
    fetchTareasPorEntidad,
    fetchMisTareasPendientes,
    crearTarea,
    marcarCompletada,
    actualizarTarea,
    eliminarTarea,
    tareasProximas,
    refrescarTareasProximas,
    descartarTareaProxima,
    cargarDescartadasGuardadas,
  }
}