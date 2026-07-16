export interface LeadInteraccion {
  id: string
  lead_id: string
  canal: 'whatsapp' | 'instagram' | 'facebook' | 'llamada' | 'web' | 'correo'
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

  // .select() para poder verificar filas afectadas: si RLS bloquea el
  // delete, Supabase no tira error (0 filas es un resultado válido), así
  // que sin este chequeo la UI mostraría éxito con la fila intacta.
  async function eliminarInteraccion(id: string): Promise<void> {
    const { data, error } = await supabase.from('lead_interacciones').delete().eq('id', id).select()
    if (error) throw error
    if (!data || data.length === 0) throw new Error('No tenés permiso para eliminar esta interacción')
  }

  return { fetchInteracciones, agregarInteraccion, eliminarInteraccion }
}