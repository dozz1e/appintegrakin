// composables/useTickets.ts

export type EstadoTicket = 'abierto' | 'en_proceso' | 'esperando_cliente' | 'resuelto' | 'cerrado'
export type PrioridadTicket = 'baja' | 'media' | 'alta' | 'urgente'

export interface Ticket {
  id: string
  cliente_id: string
  titulo: string
  descripcion: string | null
  estado: EstadoTicket
  prioridad: PrioridadTicket
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
}

export const useTickets = () => {
  const supabase = useSupabaseClient()

  const fetchTickets = async (filtroEstado?: EstadoTicket) => {
    let query = supabase.from('tickets').select('*').order('created_at', { ascending: false })
    if (filtroEstado) query = query.eq('estado', filtroEstado)
    const { data, error } = await query
    if (error) throw error
    return data as Ticket[]
  }

  const fetchTicketsPorCliente = async (clienteId: string) => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as Ticket[]
  }

  const getTicket = async (id: string) => {
    const { data, error } = await supabase.from('tickets').select('*').eq('id', id).single()
    if (error) throw error
    return data as Ticket
  }

  const createTicket = async (payload: Partial<Ticket>) => {
    const { data, error } = await supabase.from('tickets').insert(payload).select().single()
    if (error) throw error
    return data as Ticket
  }

  const updateTicket = async (id: string, payload: Partial<Ticket>, expectedVersion?: number) => {
    let query = supabase
      .from('tickets')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (expectedVersion !== undefined) query = query.eq('version', expectedVersion)

    const { data, error } = await query.select().maybeSingle()
    if (error) throw error

    if (expectedVersion !== undefined && !data) {
      throw new Error('CONFLICTO_VERSION')
    }
    return data as Ticket
  }

  const deleteTicket = async (id: string) => {
    const { error } = await supabase.from('tickets').delete().eq('id', id)
    if (error) throw error
  }

  const cambiarEstado = (id: string, estado: EstadoTicket) => updateTicket(id, { estado })

  // requiere permiso tickets.assign - RLS lo valida server-side, esto es solo el wrapper
  const asignarTecnico = (id: string, ownerId: string) => updateTicket(id, { owner_id: ownerId })

  return {
    fetchTickets,
    fetchTicketsPorCliente,
    getTicket,
    createTicket,
    updateTicket,
    deleteTicket,
    cambiarEstado,
    asignarTecnico,
  }
}
