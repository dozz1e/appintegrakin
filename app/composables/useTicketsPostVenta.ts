export type EstadoTicketPostVenta =
  | 'pendiente_ingreso' | 'ingreso_equipo' | 'probando'
  | 'espera_repuesto' | 'listo_despacho' | 'despachado' | 'desconocido'

export interface TicketPostVenta {
  id: string
  n_guia: string
  cliente_id: string | null
  cliente_nombre_libre: string | null
  cliente_rut_libre: string | null
  cliente_celular_libre: string | null
  cliente_ciudad_libre: string | null
  producto_id: string
  descripcion_falla: string | null
  estado: EstadoTicketPostVenta
  fecha_ingreso: string
  fecha_tope: string | null
  fecha_despacho: string | null
  observaciones: string | null
  notificada_vencida: boolean
  fecha_cierre: string | null
  archivado: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TicketPostVentaConNombres extends TicketPostVenta {
  cliente_nombre: string
  cliente_rut: string | null
  producto_nombre: string
}

export interface TicketPostVentaSeguimiento {
  id: string
  ticket_id: string
  fecha: string
  comentario: string
  created_by: string | null
  created_at: string
}

function mapearFila(fila: any): TicketPostVentaConNombres {
  return {
    id: fila.id,
    n_guia: fila.n_guia,
    cliente_id: fila.cliente_id,
    cliente_nombre_libre: fila.cliente_nombre_libre,
    cliente_rut_libre: fila.cliente_rut_libre,
    cliente_celular_libre: fila.cliente_celular_libre,
    cliente_ciudad_libre: fila.cliente_ciudad_libre,
    producto_id: fila.producto_id,
    descripcion_falla: fila.descripcion_falla,
    estado: fila.estado,
    fecha_ingreso: fila.fecha_ingreso,
    fecha_tope: fila.fecha_tope,
    fecha_despacho: fila.fecha_despacho,
    observaciones: fila.observaciones,
    notificada_vencida: fila.notificada_vencida,
    fecha_cierre: fila.fecha_cierre,
    archivado: fila.archivado,
    created_by: fila.created_by,
    created_at: fila.created_at,
    updated_at: fila.updated_at,
    cliente_nombre: fila.clientes?.razon_social ?? fila.cliente_nombre_libre ?? 'Desconocido',
    cliente_rut: fila.clientes?.rut ?? fila.cliente_rut_libre ?? null,
    producto_nombre: fila.productos?.nombre ?? '',
  }
}

export function useTicketsPostVenta() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  async function fetchTickets(): Promise<TicketPostVentaConNombres[]> {
    const { data, error } = await supabase
      .from('tickets_post_venta')
      .select('*, clientes(razon_social, rut), productos(nombre)')
      .eq('archivado', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(mapearFila)
  }

  async function getTicket(id: string): Promise<TicketPostVentaConNombres> {
    const { data, error } = await supabase
      .from('tickets_post_venta')
      .select('*, clientes(razon_social, rut), productos(nombre)')
      .eq('id', id)
      .single()

    if (error) throw error
    return mapearFila(data)
  }

  async function crearTicket(payload: {
    n_guia: string
    cliente_id?: string | null
    cliente_nombre_libre?: string | null
    cliente_rut_libre?: string | null
    cliente_celular_libre?: string | null
    cliente_ciudad_libre?: string | null
    producto_id: string
    descripcion_falla: string | null
    fecha_ingreso: string
    fecha_tope: string | null
    observaciones: string | null
  }): Promise<TicketPostVenta> {
    const { data, error } = await supabase
      .from('tickets_post_venta')
      .insert({ ...payload, created_by: user.value?.sub })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function actualizarTicket(
    id: string,
    payload: Partial<Pick<TicketPostVenta, 'estado' | 'fecha_despacho' | 'fecha_tope' | 'descripcion_falla' | 'observaciones'>>
  ): Promise<TicketPostVenta> {
    const { data, error } = await supabase
      .from('tickets_post_venta')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function fetchSeguimientos(ticketId: string): Promise<TicketPostVentaSeguimiento[]> {
    const { data, error } = await supabase
      .from('tickets_post_venta_seguimientos')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  async function agregarSeguimiento(ticketId: string, fecha: string, comentario: string): Promise<TicketPostVentaSeguimiento> {
    const { data, error } = await supabase
      .from('tickets_post_venta_seguimientos')
      .insert({ ticket_id: ticketId, fecha, comentario, created_by: user.value?.sub })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function eliminarTicket(id: string): Promise<void> {
    const { error } = await supabase.from('tickets_post_venta').delete().eq('id', id)
    if (error) throw error
  }

  async function fetchTicketsPorIds(ids: string[]): Promise<Pick<TicketPostVenta, 'id' | 'n_guia'>[]> {
    if (!ids.length) return []
    const { data, error } = await supabase.from('tickets_post_venta').select('id, n_guia').in('id', ids)
    if (error) throw error
    return data as Pick<TicketPostVenta, 'id' | 'n_guia'>[]
  }

  async function fetchCerrados(): Promise<TicketPostVentaConNombres[]> {
    const { data, error } = await supabase
      .from('tickets_post_venta')
      .select('*, clientes(razon_social, rut), productos(nombre)')
      .eq('estado', 'despachado')
      .order('fecha_cierre', { ascending: false })

    if (error) throw error
    return (data ?? []).map(mapearFila)
  }

  return {
    fetchTickets,
    getTicket,
    crearTicket,
    actualizarTicket,
    eliminarTicket,
    fetchSeguimientos,
    agregarSeguimiento,
    fetchTicketsPorIds,
    fetchCerrados,
  }
}
