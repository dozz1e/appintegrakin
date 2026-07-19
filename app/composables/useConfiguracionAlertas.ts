// composables/useConfiguracionAlertas.ts

export const useConfiguracionAlertas = () => {
  const supabase = useSupabaseClient()

  const fetchDiasInactividadLeads = async (): Promise<number> => {
    const { data, error } = await supabase
      .from('configuracion_alertas')
      .select('valor')
      .eq('clave', 'leads_inactividad_dias')
      .single()
    if (error) throw error
    return data.valor
  }

  const actualizarDiasInactividadLeads = async (dias: number) => {
    const { error } = await supabase
      .from('configuracion_alertas')
      .update({ valor: dias })
      .eq('clave', 'leads_inactividad_dias')
    if (error) throw error
  }

  return { fetchDiasInactividadLeads, actualizarDiasInactividadLeads }
}
