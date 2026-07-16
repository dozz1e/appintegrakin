export interface ClienteInteraccion {
  id: string
  cliente_id: string
  canal: 'whatsapp' | 'instagram' | 'facebook' | 'llamada' | 'web' | 'correo'
  nota: string
  created_by: string | null
  created_at: string
}

export function useClienteInteracciones() {
  const supabase = useSupabaseClient()

  async function fetchInteracciones(clienteId: string): Promise<ClienteInteraccion[]> {
    const { data, error } = await supabase
      .from('cliente_interacciones')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  async function agregarInteraccion(
    clienteId: string,
    canal: ClienteInteraccion['canal'],
    nota: string
  ): Promise<ClienteInteraccion> {
    const user = useSupabaseUser()

    const { data, error } = await supabase
      .from('cliente_interacciones')
      .insert({
        cliente_id: clienteId,
        canal,
        nota,
        created_by: user.value?.sub,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function eliminarInteraccion(id: string): Promise<void> {
    const { error } = await supabase.from('cliente_interacciones').delete().eq('id', id)
    if (error) throw error
  }

  // Mapa cliente_id -> fecha de su interacción más reciente, para la columna
  // "última interacción" y los filtros de fecha en la lista de clientes.
  async function fetchUltimasInteracciones(): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from('cliente_interacciones')
      .select('cliente_id, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    const mapa: Record<string, string> = {}
    for (const fila of data ?? []) {
      if (!mapa[fila.cliente_id]) mapa[fila.cliente_id] = fila.created_at
    }
    return mapa
  }

  return { fetchInteracciones, agregarInteraccion, eliminarInteraccion, fetchUltimasInteracciones }
}
