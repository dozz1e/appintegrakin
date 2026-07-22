<script setup lang="ts">
import type { Ticket, EstadoTicket } from '~/composables/useTickets'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets', actions: ['view', 'view_all'] },
})

const { fetchTickets, cambiarEstado, createTicket } = useTickets()
const { agregarProductoATicket } = useTicketProductos()
const { subirImagen } = useEntidadImagenes()
const { can } = usePermissions()
const { success, error } = useToast()
const { descargarCSV } = useCsv()

const tickets = ref<Ticket[]>([])
const cargando = ref(true)
const guardando = ref(false)
const modalAbierto = ref(false)
const busqueda = ref('')

onMounted(async () => {
  tickets.value = await fetchTickets()
  cargando.value = false
})

const ticketsFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return tickets.value
  return tickets.value.filter(
    (t) =>
      t.clientes?.razon_social?.toLowerCase().includes(q) ||
      t.clientes?.rut?.toLowerCase().includes(q)
  )
})

function onExportar() {
  const filas = tickets.value.map((t) => ({
    cliente: t.clientes?.razon_social ?? '',
    rut: t.clientes?.rut ?? '',
    titulo: t.titulo,
    estado: t.estado,
    prioridad: t.prioridad,
    creado: t.created_at,
    cerrado: t.fecha_cierre ?? '',
  }))
  descargarCSV('tickets_servicio_tecnico', filas)
}

const onCambiarEstado = async (id: string, estado: EstadoTicket) => {
  const actualizado = await cambiarEstado(id, estado)
  const idx = tickets.value.findIndex((t) => t.id === id)
  if (idx !== -1) tickets.value[idx] = actualizado
}

async function onSubmit(payload: Record<string, unknown>, archivos: File[], productosIds: string[]) {
  guardando.value = true
  try {
    const ticket = await createTicket(payload)
    if (archivos.length) {
      try {
        for (const archivo of archivos) await subirImagen('ticket', ticket.id, archivo)
      } catch (e) {
        error('Ticket creado, pero no se pudieron subir todos los archivos')
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
    modalAbierto.value = false
    tickets.value = await fetchTickets()
  } catch (e) {
    error('No se pudo crear el ticket. Intenta de nuevo.')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Tickets de servicio técnico">
      <template #accion>
        <div class="flex items-center gap-2">
          <button
            class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            @click="onExportar"
          >
            Exportar CSV
          </button>
          <button
            v-if="can('tickets', 'create')"
            class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            @click="modalAbierto = true"
          >
            + Nuevo ticket
          </button>
        </div>
      </template>
    </SharedPageHeader>

    <div class="flex flex-wrap gap-2 mb-4">
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por cliente o RUT..."
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
    </div>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <TicketsTicketBoard v-else :tickets="ticketsFiltrados" @cambiar-estado="onCambiarEstado" />

    <SharedModal :open="modalAbierto" titulo="Nuevo ticket" @cerrar="modalAbierto = false">
      <TicketsTicketForm :cargando="guardando" @submit="onSubmit" />
    </SharedModal>
  </div>
</template>
