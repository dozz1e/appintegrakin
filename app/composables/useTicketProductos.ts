// composables/useTicketProductos.ts

import type { Producto } from '~/composables/useProductos'

export function useTicketProductos() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  async function fetchProductosDeTicket(
    ticketId: string
  ): Promise<Pick<Producto, 'id' | 'nombre' | 'sku'>[]> {
    const { data, error } = await supabase
      .from('ticket_productos')
      .select('productos(id, nombre, sku)')
      .eq('ticket_id', ticketId)
    if (error) throw error
    return (data ?? []).map((r: any) => r.productos).filter(Boolean)
  }

  async function agregarProductoATicket(ticketId: string, productoId: string): Promise<void> {
    const { error } = await supabase
      .from('ticket_productos')
      .insert({ ticket_id: ticketId, producto_id: productoId, created_by: user.value?.sub })
    if (error) throw error
  }

  async function quitarProductoDeTicket(ticketId: string, productoId: string): Promise<void> {
    const { data, error } = await supabase
      .from('ticket_productos')
      .delete()
      .eq('ticket_id', ticketId)
      .eq('producto_id', productoId)
      .select()
    if (error) throw error
    if (!data?.length) throw new Error('No se pudo quitar el producto')
  }

  return { fetchProductosDeTicket, agregarProductoATicket, quitarProductoDeTicket }
}
