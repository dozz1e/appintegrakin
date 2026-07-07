export interface FunnelItem {
  estado: string
  total: number
}

export interface PerformanceVendedor {
  vendedor_id: string
  full_name: string | null
  leads_total: number
  leads_ganados: number
  leads_perdidos: number
  tickets_total: number
  tickets_resueltos: number
}

export function useReportes() {
  const supabase = useSupabaseClient()

  async function fetchFunnel(): Promise<FunnelItem[]> {
    const { data, error } = await supabase
      .from('vista_funnel_leads')
      .select('*')

    if (error) throw error

    // ordenar según el orden lógico del pipeline, no alfabético
    const orden = ['nuevo', 'contactado', 'cotizado', 'negociacion', 'ganado', 'perdido']
    return (data ?? []).sort((a, b) => orden.indexOf(a.estado) - orden.indexOf(b.estado))
  }

  async function fetchPerformance(): Promise<PerformanceVendedor[]> {
    const { data, error } = await supabase
      .from('vista_performance_vendedores')
      .select('*')
      .order('leads_ganados', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  return { fetchFunnel, fetchPerformance }
}