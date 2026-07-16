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

  async function actualizarVenta(
    id: string,
    payload: Partial<Pick<Venta, 'producto_id' | 'valor' | 'fecha'>>,
    expectedVersion?: number
  ): Promise<Venta> {
    let query = supabase
      .from('ventas')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (expectedVersion !== undefined) query = query.eq('version', expectedVersion)

    const { data, error } = await query.select().maybeSingle()
    if (error) throw error

    if (expectedVersion !== undefined && !data) {
      throw new Error('CONFLICTO_VERSION')
    }
    return data
  }

  async function eliminarVenta(id: string): Promise<void> {
    const { data, error } = await supabase.from('ventas').delete().eq('id', id).select()
    if (error) throw error
    if (!data?.length) throw new Error('No se pudo eliminar la venta')
  }

  return { fetchVentasPorCliente, crearVenta, actualizarVenta, eliminarVenta }
}
