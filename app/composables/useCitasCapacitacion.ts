export type EstadoCita = 'pendiente' | 'completada' | 'cancelada'

export interface CitaCapacitacion {
  id: string
  cliente_id: string
  producto_id: string
  titulo: string
  notas: string | null
  fecha_hora: string
  estado: EstadoCita
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CitaCapacitacionConNombres extends CitaCapacitacion {
  cliente_nombre: string
  producto_nombre: string
}

import { obtenerUmbralesMinutos, calcularTierActual } from './useUmbralesAlertas'

function mapearFila(fila: any): CitaCapacitacionConNombres {
  return {
    id: fila.id,
    cliente_id: fila.cliente_id,
    producto_id: fila.producto_id,
    titulo: fila.titulo,
    notas: fila.notas,
    fecha_hora: fila.fecha_hora,
    estado: fila.estado,
    owner_id: fila.owner_id,
    created_by: fila.created_by,
    created_at: fila.created_at,
    updated_at: fila.updated_at,
    cliente_nombre: fila.clientes?.razon_social ?? '',
    producto_nombre: fila.productos?.nombre ?? '',
  }
}

export function useCitasCapacitacion() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { error: toastError } = useToast()

  const citasProximas = useState<CitaCapacitacionConNombres[]>('citas-proximas', () => [])
  const idsCitasDescartadas = useState<Set<string>>('citas-proximas-descartadas', () => new Set())
  const tierActualCitas = useState<Map<string, number>>('citas-proximas-tier', () => new Map())

  async function fetchCitas(): Promise<CitaCapacitacionConNombres[]> {
    const { data, error } = await supabase
      .from('citas_capacitacion')
      .select('*, clientes(razon_social), productos(nombre)')
      .order('fecha_hora', { ascending: true })

    if (error) throw error
    return (data ?? []).map(mapearFila)
  }

  async function crearCita(payload: {
    cliente_id: string
    producto_id: string
    titulo: string
    notas: string | null
    fecha_hora: string
    owner_id?: string
  }): Promise<CitaCapacitacion> {
    const { data, error } = await supabase
      .from('citas_capacitacion')
      .insert({
        ...payload,
        owner_id: payload.owner_id ?? user.value?.sub,
        created_by: user.value?.sub,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function actualizarCita(
    id: string,
    payload: Partial<Pick<CitaCapacitacion, 'titulo' | 'notas' | 'fecha_hora' | 'estado' | 'owner_id' | 'producto_id' | 'cliente_id'>>
  ): Promise<CitaCapacitacion> {
    const { data, error } = await supabase
      .from('citas_capacitacion')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // "Mis" próximas = responsable de la cita (owner_id, o created_by si no
  // tiene owner), sin depender de view_all - mismo criterio que
  // fetchMisTareasPendientes (ver gotcha #16 de CONTEXTO_PROYECTO.md).
  async function fetchMisCitasPendientes(): Promise<CitaCapacitacionConNombres[]> {
    if (!user.value) return []
    const uid = user.value.sub
    const { data, error } = await supabase
      .from('citas_capacitacion')
      .select('*, clientes(razon_social), productos(nombre)')
      .eq('estado', 'pendiente')
      .or(`owner_id.eq.${uid},and(owner_id.is.null,created_by.eq.${uid})`)
      .order('fecha_hora', { ascending: true })

    if (error) throw error
    return (data ?? []).map(mapearFila)
  }

  async function refrescarCitasProximas(): Promise<void> {
    const { perfil } = useMiPerfil()
    const umbralesMinutos = obtenerUmbralesMinutos(perfil.value?.settings)

    const pendientes = await fetchMisCitasPendientes()
    const ahora = Date.now()
    const nuevoTier = new Map<string, number>()
    citasProximas.value = pendientes.filter((c) => {
      const msRestante = new Date(c.fecha_hora).getTime() - ahora
      const tier = calcularTierActual(msRestante, umbralesMinutos)
      if (tier === null) return false
      nuevoTier.set(c.id, tier)
      return !idsCitasDescartadas.value.has(`${c.id}:${tier}`)
    })
    tierActualCitas.value = nuevoTier

    const idsPendientes = new Set(pendientes.map((c) => c.id))
    const idsPodados = new Set<string>()
    for (const clave of idsCitasDescartadas.value) {
      const citaId = clave.split(':')[0]
      if (!idsPendientes.has(citaId)) {
        idsCitasDescartadas.value.delete(clave)
        idsPodados.add(citaId)
      }
    }
    if (idsPodados.size > 0 && user.value) {
      await supabase.from('citas_descartadas').delete().eq('user_id', user.value.sub).in('cita_id', [...idsPodados])
    }
  }

  async function descartarCitaProxima(id: string): Promise<void> {
    const citaDescartada = citasProximas.value.find((c) => c.id === id)
    const tier = tierActualCitas.value.get(id) ?? 0
    const clave = `${id}:${tier}`
    idsCitasDescartadas.value.add(clave)
    citasProximas.value = citasProximas.value.filter((c) => c.id !== id)

    if (!user.value) return
    const { error } = await supabase
      .from('citas_descartadas')
      .upsert({ user_id: user.value.sub, cita_id: id, umbral_minutos: tier }, { onConflict: 'user_id,cita_id,umbral_minutos' })

    if (error) {
      idsCitasDescartadas.value.delete(clave)
      if (citaDescartada) citasProximas.value = [...citasProximas.value, citaDescartada]
      toastError('No se pudo descartar el aviso, intenta de nuevo')
    }
  }

  async function cargarDescartadasGuardadas(): Promise<void> {
    if (!user.value) return
    const { data, error } = await supabase
      .from('citas_descartadas')
      .select('cita_id, umbral_minutos')
      .eq('user_id', user.value.sub)

    if (error) return
    idsCitasDescartadas.value = new Set((data ?? []).map((d) => `${d.cita_id}:${d.umbral_minutos}`))
  }

  return {
    fetchCitas,
    crearCita,
    actualizarCita,
    citasProximas,
    refrescarCitasProximas,
    descartarCitaProxima,
    cargarDescartadasGuardadas,
  }
}
