// app/composables/useLeadsPipeline.ts
export function useLeadsPipeline() {
  const supabase = useSupabaseClient()
  const leads = ref<Record<string, any[]>>({
    nuevo: [], contactado: [], cotizado: [], negociacion: [], ganado: [], perdido: []
  })
  const loading = ref(false)

  async function cargarLeads() {
    loading.value = true
    const { data, error } = await supabase
      .from('leads')
      .select('*, owner:profiles!owner_id(nombre)') // <-- el select que te pasé va acá
      .order('updated_at', { ascending: false })

    if (error) {
      useToast().error('Error cargando leads: ' + error.message)
      loading.value = false
      return
    }

    for (const key of Object.keys(leads.value)) leads.value[key] = []
    for (const lead of data) {
      leads.value[lead.estado]?.push(lead)
    }
    loading.value = false
  }

  async function moverLead(leadId: string, nuevoEstado: string) {
    const { error } = await supabase.rpc('mover_lead_estado', {
      p_lead_id: leadId,
      p_nuevo_estado: nuevoEstado
    })

    if (error) {
      useToast().error('No se pudo mover el lead: ' + error.message)
      await cargarLeads()
      return false
    }
    return true
  }

  return { leads, loading, cargarLeads, moverLead }
}