<!-- app/pages/post-venta/index.vue -->
<script setup lang="ts">
import type { EstadoTicketPostVenta, TicketPostVentaConNombres } from '~/composables/useTicketsPostVenta'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets_post_venta', actions: ['view'] },
})

const { fetchTickets, crearTicket, actualizarTicket } = useTicketsPostVenta()
const { success, error } = useToast()
const { can } = usePermissions()

const tickets = ref<TicketPostVentaConNombres[]>([])
const cargando = ref(true)
const guardando = ref(false)
const modalAbierto = ref(false)

async function cargar() {
  cargando.value = true
  tickets.value = await fetchTickets()
  cargando.value = false
}

onMounted(cargar)

async function onSubmit(payload: Record<string, unknown>) {
  guardando.value = true
  try {
    await crearTicket(payload as any)
    success('Ticket creado')
    modalAbierto.value = false
    await cargar()
  } catch (e) {
    error('No se pudo crear el ticket. Intenta de nuevo.')
  } finally {
    guardando.value = false
  }
}

async function onCambiarEstado(id: string, estado: EstadoTicketPostVenta) {
  try {
    await actualizarTicket(id, { estado })
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
        <button
          v-if="can('tickets_post_venta', 'create')"
          class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          @click="modalAbierto = true"
        >
          + Nuevo ticket
        </button>
      </template>
    </SharedPageHeader>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <PostVentaTicketBoard v-else :tickets="tickets" @cambiar-estado="onCambiarEstado" />

    <SharedModal :open="modalAbierto" titulo="Nuevo ticket de post venta" @cerrar="modalAbierto = false">
      <PostVentaTicketForm :cargando="guardando" @submit="onSubmit" />
    </SharedModal>
  </div>
</template>
