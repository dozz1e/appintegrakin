<script setup lang="ts">
definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets', actions: ['create'] },
})

const route = useRoute()
const router = useRouter()
const { createTicket } = useTickets()
const { getCliente } = useClientes()
const { agregarProductoATicket } = useTicketProductos()
const { subirImagen } = useEntidadImagenes()
const { success, error } = useToast()

const clienteIdFijo = route.query.cliente_id as string | undefined
const clienteNombreFijo = ref<string>()
const cargando = ref(false)

onMounted(async () => {
  if (clienteIdFijo) {
    const cliente = await getCliente(clienteIdFijo)
    clienteNombreFijo.value = cliente.razon_social
  }
})

const onSubmit = async (payload: Record<string, unknown>, archivo: File | null, productosIds: string[]) => {
  cargando.value = true
  try {
    const ticket = await createTicket(payload)
    if (archivo) {
      try {
        await subirImagen('ticket', ticket.id, archivo)
      } catch (e) {
        error('Ticket creado, pero no se pudo subir la imagen')
      }
    }
    if (productosIds.length) {
      try {
        await Promise.all(productosIds.map((id) => agregarProductoATicket(ticket.id, id)))
      } catch (e) {
        error('Ticket creado, pero no se pudieron asociar los productos')
      }
    }
    success('Ticket creado correctamente')
    await router.push(`/tickets/${ticket.id}`)
  } catch (e) {
    error('No se pudo crear el ticket. Intenta de nuevo.')
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-lg">
    <SharedPageHeader titulo="Nuevo ticket" volver-a="/tickets" />
    <SharedCard>
      <TicketsTicketForm
        :cargando="cargando"
        :cliente-id-fijo="clienteIdFijo"
        :cliente-nombre-fijo="clienteNombreFijo"
        @submit="onSubmit"
      />
    </SharedCard>
  </div>
</template>
