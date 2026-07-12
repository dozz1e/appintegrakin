<script setup lang="ts">
import type { Ticket } from '~/composables/useTickets'
import type { Usuario } from '~/composables/useUsuarios'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets', actions: ['view', 'view_all'] },
})

const route = useRoute()
const { getTicket, updateTicket, deleteTicket, asignarTecnico } = useTickets()
const { fetchUsuariosPorRol } = useUsuarios()
const { can } = usePermissions()
const { success, error } = useToast()

const ticket = ref<Ticket | null>(null)
const tecnicos = ref<Usuario[]>([])
const cargando = ref(true)
const guardando = ref(false)
const asignando = ref(false)
const confirmandoEliminar = ref(false)
const eliminando = ref(false)

onMounted(async () => {
  ticket.value = await getTicket(route.params.id as string)
  if (can('tickets', 'assign')) {
    tecnicos.value = await fetchUsuariosPorRol('servicio_tecnico')
  }
  cargando.value = false
})

const onSubmit = async (payload: Record<string, unknown>) => {
  if (!ticket.value) return
  guardando.value = true
  try {
    ticket.value = await updateTicket(ticket.value.id, payload, ticket.value.version)
    success('Ticket actualizado')
  } catch (e: any) {
    if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este ticket mientras lo tenías abierto. Se recargaron los datos actuales, revisa e intenta de nuevo.')
      ticket.value = await getTicket(route.params.id as string)
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  } finally {
    guardando.value = false
  }
}

const onAsignar = async (tecnicoId: string) => {
  if (!ticket.value || !tecnicoId) return
  asignando.value = true
  try {
    ticket.value = await asignarTecnico(ticket.value.id, tecnicoId)
    success('Técnico asignado')
  } catch (e) {
    error('No se pudo asignar el técnico. Intenta de nuevo.')
  } finally {
    asignando.value = false
  }
}

async function onConfirmarEliminar() {
  if (!ticket.value) return
  eliminando.value = true
  try {
    await deleteTicket(ticket.value.id)
    success('Ticket eliminado')
    await navigateTo('/tickets')
  } catch (e) {
    error('No se pudo eliminar el ticket. Intenta de nuevo.')
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-4xl">
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <template v-else-if="ticket">
      <SharedPageHeader :titulo="ticket.titulo" volver-a="/tickets">
        <template #accion>
          <SharedBadge :label="colorTicket(ticket.estado).label" :clases="colorTicket(ticket.estado).clases" />
        </template>
      </SharedPageHeader>

      <div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 items-start">
        <SharedCard>
          <TicketsTicketForm :model-value="ticket" :cargando="guardando" @submit="onSubmit" />
        </SharedCard>

        <div class="space-y-6">
          <SharedCard v-if="can('tickets', 'assign')" titulo="Técnico asignado">
            <select
              :value="ticket.owner_id ?? ''"
              :disabled="asignando"
              class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
              @change="onAsignar(($event.target as HTMLSelectElement).value)"
            >
              <option value="" disabled>Sin asignar</option>
              <option v-for="t in tecnicos" :key="t.id" :value="t.id">
                {{ t.full_name || t.email }}
              </option>
            </select>
          </SharedCard>

          <SharedCard v-if="can('tickets', 'delete')">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-sm font-semibold text-gray-700">Eliminar ticket</h2>
                <p class="text-xs text-gray-400 mt-1">Esta acción no se puede deshacer.</p>
              </div>
              <button
                type="button"
                class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                @click="confirmandoEliminar = true"
              >
                Eliminar ticket
              </button>
            </div>
          </SharedCard>
        </div>
      </div>

      <SharedConfirmDialog
        :open="confirmandoEliminar"
        titulo="Eliminar ticket"
        :mensaje="`¿Eliminar &quot;${ticket.titulo}&quot;? Esta acción no se puede deshacer.`"
        :cargando="eliminando"
        @confirmar="onConfirmarEliminar"
        @cancelar="confirmandoEliminar = false"
      />
    </template>
    <p v-else class="text-red-600">Ticket no encontrado</p>
  </div>
</template>
