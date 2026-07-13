export interface Venta {
  id: string
  cliente_id: string
  producto_id: string
  valor: number
  fecha: string
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
}

export function useVentas() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  async function fetchVentasPorCliente(clienteId: string): Promise<Venta[]> {
    const { data, error } = await supabase
      .from('ventas')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  async function crearVenta(
    clienteId: string,
    productoId: string,
    valor: number,
    fecha: string
  ): Promise<Venta> {
    const { data, error } = await supabase
      .from('ventas')
      .insert({
        cliente_id: clienteId,
        producto_id: productoId,
        valor,
        fecha,
        owner_id: user.value?.sub,
        created_by: user.value?.sub,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  return { fetchVentasPorCliente, crearVenta }
}
