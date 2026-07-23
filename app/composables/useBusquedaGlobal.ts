// composables/useBusquedaGlobal.ts
//
// Busca en paralelo sobre clientes/leads/tickets. No reimplementa RLS: cada
// query pasa por supabase-js normal, así que un usuario solo ve resultados
// de lo que ya podría ver en sus páginas normales (view vs view_all).

import type { Cliente } from './useClientes'
import type { Lead } from './useLeads'
import type { Ticket } from './useTickets'

export interface ResultadoBusqueda {
  clientes: Cliente[]
  leads: Lead[]
  tickets: Ticket[]
}

const LIMITE_POR_CATEGORIA = 5

// escapa % y _ para que no se interpreten como wildcards de ILIKE si el
// usuario los tipea literalmente en la búsqueda
function escaparIlike(texto: string) {
  return texto.replace(/[%_]/g, (m) => `\\${m}`)
}

export const useBusquedaGlobal = () => {
  const supabase = useSupabaseClient()

  const buscar = async (termino: string): Promise<ResultadoBusqueda> => {
    const q = escaparIlike(normalizarTexto(termino.trim()))
    if (q.length < 2) return { clientes: [], leads: [], tickets: [] }

    const [clientesRes, leadsRes, ticketsRes] = await Promise.all([
      supabase
        .from('clientes')
        .select('*')
        .ilike('busqueda_normalizada', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(LIMITE_POR_CATEGORIA),

      supabase
        .from('leads')
        .select('*')
        .ilike('busqueda_normalizada', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(LIMITE_POR_CATEGORIA),

      supabase
        .from('tickets')
        .select('*')
        .ilike('busqueda_normalizada', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(LIMITE_POR_CATEGORIA),
    ])

    if (clientesRes.error) throw clientesRes.error
    if (leadsRes.error) throw leadsRes.error
    if (ticketsRes.error) throw ticketsRes.error

    return {
      clientes: (clientesRes.data ?? []) as Cliente[],
      leads: (leadsRes.data ?? []) as Lead[],
      tickets: (ticketsRes.data ?? []) as Ticket[],
    }
  }

  return { buscar }
}