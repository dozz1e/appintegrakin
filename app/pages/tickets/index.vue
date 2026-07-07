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

onMounted(async () => {
  tickets.value = await fetchTickets()
  cargando.value = false
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

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <TicketsTicketBoard v-else :tickets="tickets" @cambiar-estado="onCambiarEstado" />
  </div>
</template>
