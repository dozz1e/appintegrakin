export function useTicketsPipeline() {
  const supabase = useSupabaseClient()
  const tickets = ref<Record<string, any[]>>({
    abierto: [], en_proceso: [], esperando_cliente: [], resuelto: [], cerrado: []
  })
  const loading = ref(false)

  async function cargarTickets() {
    loading.value = true
    const { data, error } = await supabase
      .from('tickets')
      .select('*, cliente:clientes(razon_social)')
      .order('updated_at', { ascending: false })

    if (error) {
      useToast().error('Error cargando tickets: ' + error.message)
      loading.value = false
      return
    }

    for (const key of Object.keys(tickets.value)) tickets.value[key] = []
    for (const t of data) {
      tickets.value[t.estado]?.push(t)
    }
    loading.value = false
  }

  async function moverTicket(ticketId: string, nuevoEstado: string) {
    const { error } = await supabase.rpc('mover_ticket_estado', {
      p_ticket_id: ticketId,
      p_nuevo_estado: nuevoEstado
    })

    if (error) {
      useToast().error('No se pudo mover el ticket: ' + error.message)
      await cargarTickets()
      return false
    }
    return true
  }

  return { tickets, loading, cargarTickets, moverTicket }
}