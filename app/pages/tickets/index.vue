<script setup lang="ts">
import type { Ticket, EstadoTicket } from '~/composables/useTickets'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets', actions: ['view', 'view_all'] },
})

const { fetchTickets, cambiarEstado } = useTickets()
const { can } = usePermissions()

const tickets = ref<Ticket[]>([])
const cargando = ref(true)
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

const onCambiarEstado = async (id: string, estado: EstadoTicket) => {
  const actualizado = await cambiarEstado(id, estado)
  const idx = tickets.value.findIndex((t) => t.id === id)
  if (idx !== -1) tickets.value[idx] = actualizado
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Tickets de servicio técnico">
      <template #accion>
        <NuxtLink
          v-if="can('tickets', 'create')"
          to="/tickets/nuevo"
          class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Nuevo ticket
        </NuxtLink>
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
  </div>
</template>
