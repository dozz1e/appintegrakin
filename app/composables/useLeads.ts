// composables/useLeads.ts

export type EstadoLead = 'nuevo' | 'contactado' | 'cotizado' | 'negociacion' | 'ganado' | 'perdido'

export interface Lead {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  origen: string | null
  estado: EstadoLead
  cliente_id: string | null
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
  fecha_cierre: string | null
  archivado: boolean
}

export const useLeads = () => {
  const supabase = useSupabaseClient()

  const fetchLeads = async (filtroEstado?: EstadoLead) => {
    let query = supabase.from('leads').select('*').eq('archivado', false).order('created_at', { ascending: false })
    if (filtroEstado) query = query.eq('estado', filtroEstado)
    const { data, error } = await query
    if (error) throw error
    return data as Lead[]
  }

  const getLead = async (id: string) => {
    const { data, error } = await supabase.from('leads').select('*').eq('id', id).single()
    if (error) throw error
    return data as Lead
  }

  const createLead = async (payload: Partial<Lead>) => {
    const user = useSupabaseUser()
    const { data, error } = await supabase
      .from('leads')
      .insert({ ...payload, owner_id: payload.owner_id ?? user.value?.sub, created_by: user.value?.sub })
      .select()
      .single()
    if (error) throw error
    return data as Lead
  }

  const updateLead = async (id: string, payload: Partial<Lead>, expectedVersion?: number) => {
    let query = supabase
      .from('leads')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (expectedVersion !== undefined) query = query.eq('version', expectedVersion)

    const { data, error } = await query.select().maybeSingle()
    if (error) throw error

    // si se pidió chequeo de versión y no volvió ninguna fila, alguien más
    // ya guardó cambios sobre este registro mientras estaba abierto
    if (expectedVersion !== undefined && !data) {
      throw new Error('CONFLICTO_VERSION')
    }
    return data as Lead
  }

  const deleteLead = async (id: string) => {
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) throw error
  }

  const fetchLeadsPorIds = async (ids: string[]): Promise<Pick<Lead, 'id' | 'nombre'>[]> => {
    if (!ids.length) return []
    const { data, error } = await supabase.from('leads').select('id, nombre').in('id', ids)
    if (error) throw error
    return data as Pick<Lead, 'id' | 'nombre'>[]
  }

  const fetchCerrados = async (): Promise<Lead[]> => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .in('estado', ['ganado', 'perdido'])
      .order('fecha_cierre', { ascending: false })
    if (error) throw error
    return data as Lead[]
  }

  const cambiarEstado = (id: string, estado: EstadoLead) => updateLead(id, { estado })

  // requiere permiso leads.assign (se valida por RLS del lado servidor)
  const asignarLead = (id: string, ownerId: string) => updateLead(id, { owner_id: ownerId })

  const convertirACliente = async (leadId: string, rut: string, razonSocial: string) => {
    const { data, error } = await supabase.rpc('convertir_lead_a_cliente', {
      p_lead_id: leadId,
      p_rut: rut,
      p_razon_social: razonSocial,
    })
    if (error) throw error
    return data as string // id del cliente creado
  }

  // Importación masiva con deduplicación por teléfono/email. No hay unique
  // constraint en la tabla para estos campos, así que la dedupe se hace acá:
  // se trae lo que el usuario ya puede ver (RLS aplica solo) y se descartan
  // coincidencias antes del insert.
  const importLeads = async (filas: Record<string, string>[]) => {
    const user = useSupabaseUser()

    const { data: existentes, error: errorExistentes } = await supabase
      .from('leads')
      .select('telefono, email')
    if (errorExistentes) throw errorExistentes

    const telefonosExistentes = new Set((existentes ?? []).map((l) => l.telefono).filter(Boolean))
    const emailsExistentes = new Set((existentes ?? []).map((l) => l.email?.toLowerCase()).filter(Boolean))

    let omitidos = 0
    const candidatos = filas
      .filter((f) => f.nombre?.trim())
      .filter((f) => {
        const tel = f.telefono?.trim()
        const mail = f.email?.trim().toLowerCase()
        const esDuplicado = (tel && telefonosExistentes.has(tel)) || (mail && emailsExistentes.has(mail))
        if (esDuplicado) omitidos++
        return !esDuplicado
      })
      .map((f) => ({
        nombre: f.nombre.trim(),
        telefono: f.telefono?.trim() || null,
        email: f.email?.trim() || null,
        origen: f.origen?.trim() || 'importacion',
        estado: 'nuevo' as EstadoLead,
        owner_id: user.value?.sub,
        created_by: user.value?.sub,
      }))

    if (!candidatos.length) return { insertados: 0, omitidos: filas.length }

    const { data, error } = await supabase.from('leads').insert(candidatos).select()
    if (error) throw error

    return { insertados: data?.length ?? 0, omitidos }
  }

  return {
    fetchLeads,
    getLead,
    createLead,
    updateLead,
    deleteLead,
    cambiarEstado,
    asignarLead,
    convertirACliente,
    importLeads,
    fetchLeadsPorIds,
    fetchCerrados,
  }
}
