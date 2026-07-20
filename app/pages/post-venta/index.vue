<!-- app/pages/post-venta/index.vue -->
<script setup lang="ts">
import type { EstadoTicketPostVenta, TicketPostVentaConNombres } from '~/composables/useTicketsPostVenta'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets_post_venta', actions: ['view'] },
})

const { fetchTickets, crearTicket, actualizarTicket } = useTicketsPostVenta()
const { subirImagen } = useEntidadImagenes()
const { success, error } = useToast()
const { can } = usePermissions()
const { descargarCSV } = useCsv()

const tickets = ref<TicketPostVentaConNombres[]>([])
const cargando = ref(true)
const guardando = ref(false)
const modalAbierto = ref(false)
const busqueda = ref('')

async function cargar() {
  cargando.value = true
  tickets.value = await fetchTickets()
  cargando.value = false
}

const ticketsFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return tickets.value
  return tickets.value.filter(
    (t) =>
      t.cliente_nombre.toLowerCase().includes(q) ||
      t.cliente_rut?.toLowerCase().includes(q) ||
      t.n_guia.toLowerCase().includes(q)
  )
})

onMounted(cargar)

async function onSubmit(payload: Record<string, unknown>, archivo: File | null) {
  guardando.value = true
  try {
    const ticket = await crearTicket(payload as any)
    if (archivo) {
      try {
        await subirImagen('ticket_post_venta', ticket.id, archivo)
      } catch (e) {
        error('Ticket creado, pero no se pudo subir la imagen')
      }
    }
    success('Ticket creado')
    modalAbierto.value = false
    await cargar()
  } catch (e) {
    error('No se pudo crear el ticket. Intenta de nuevo.')
  } finally {
    guardando.value = false
  }
}

function onExportar() {
  const filas = tickets.value.map((t) => ({
    cliente: t.cliente_nombre,
    rut: t.cliente_rut ?? '',
    n_guia: t.n_guia,
    producto: t.producto_nombre,
    estado: t.estado,
    ingreso: t.fecha_ingreso ?? '',
    tope: t.fecha_tope ?? '',
    despacho: t.fecha_despacho ?? '',
  }))
  descargarCSV('tickets_post_venta', filas)
}

async function onCambiarEstado(id: string, estado: EstadoTicketPostVenta) {
  try {
    const payload: Partial<{ estado: EstadoTicketPostVenta; fecha_ingreso: string }> = { estado }
    if (estado === 'ingreso_equipo') {
      const ticket = tickets.value.find((t) => t.id === id)
      if (ticket && !ticket.fecha_ingreso) {
        payload.fecha_ingreso = new Date().toISOString().slice(0, 10)
      }
    }
    await actualizarTicket(id, payload)
    await cargar()
  } catch (e) {
    error('No se pudo actualizar el estado')
  }
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Post Venta">
      <template #accion>
        <div class="flex items-center gap-2">
          <button
            class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            @click="onExportar"
          >
            Exportar CSV
          </button>
          <button
            v-if="can('tickets_post_venta', 'create')"
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
        placeholder="Buscar por cliente, RUT o N° de guía..."
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
    </div>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <PostVentaTicketBoard v-else :tickets="ticketsFiltrados" @cambiar-estado="onCambiarEstado" />

    <SharedModal :open="modalAbierto" titulo="Nuevo ticket de post venta" @cerrar="modalAbierto = false">
      <PostVentaTicketForm :cargando="guardando" @submit="onSubmit" />
    </SharedModal>
  </div>
</template>
