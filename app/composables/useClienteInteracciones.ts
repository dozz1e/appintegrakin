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

  // .select() para poder verificar filas afectadas: si RLS bloquea el
  // delete, Supabase no tira error (0 filas es un resultado válido), así
  // que sin este chequeo la UI mostraría éxito con la fila intacta.
  async function actualizarInteraccion(
    id: string,
    canal: ClienteInteraccion['canal'],
    nota: string
  ): Promise<ClienteInteraccion> {
    const { data, error } = await supabase
      .from('cliente_interacciones')
      .update({ canal, nota })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function eliminarInteraccion(id: string): Promise<void> {
    const { data, error } = await supabase.from('cliente_interacciones').delete().eq('id', id).select()
    if (error) throw error
    if (!data || data.length === 0) throw new Error('No tenés permiso para eliminar esta interacción')
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

  return { fetchInteracciones, agregarInteraccion, actualizarInteraccion, eliminarInteraccion, fetchUltimasInteracciones }
}
