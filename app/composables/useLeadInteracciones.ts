export interface LeadInteraccion {
  id: string
  lead_id: string
  canal: 'correo' | 'texto' | 'telefono'
  nota: string
  created_by: string | null
  created_at: string
}

export function useLeadInteracciones() {
  const supabase = useSupabaseClient()

  async function fetchInteracciones(leadId: string): Promise<LeadInteraccion[]> {
    const { data, error } = await supabase
      .from('lead_interacciones')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  async function agregarInteraccion(
    leadId: string,
    canal: LeadInteraccion['canal'],
    nota: string
  ): Promise<LeadInteraccion> {
    const user = useSupabaseUser()

    const { data, error } = await supabase
      .from('lead_interacciones')
      .insert({
        lead_id: leadId,
        canal,
        nota,
        created_by: user.value?.sub, // .sub, no .id — gotcha del JWT
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  return { fetchInteracciones, agregarInteraccion }
}