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
}

export const useLeads = () => {
  const supabase = useSupabaseClient()

  const fetchLeads = async (filtroEstado?: EstadoLead) => {
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false })
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
    const { data, error } = await supabase.from('leads').insert(payload).select().single()
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

  return { fetchLeads, getLead, createLead, updateLead, cambiarEstado, asignarLead, convertirACliente }
}