<script setup lang="ts">
import type { Ticket } from '~/composables/useTickets'
import type { Usuario } from '~/composables/useUsuarios'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets', actions: ['view', 'view_all'] },
})

const route = useRoute()
const { getTicket, updateTicket, asignarTecnico } = useTickets()
const { fetchUsuariosPorRol } = useUsuarios()
const { can } = usePermissions()
const { success, error } = useToast()

const ticket = ref<Ticket | null>(null)
const tecnicos = ref<Usuario[]>([])
const cargando = ref(true)
const guardando = ref(false)
const asignando = ref(false)

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
</script>

<template>
  <div class="p-6 max-w-lg">
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <template v-else-if="ticket">
      <SharedPageHeader :titulo="ticket.titulo" volver-a="/tickets">
        <template #accion>
          <SharedBadge :label="colorTicket(ticket.estado).label" :clases="colorTicket(ticket.estado).clases" />
        </template>
      </SharedPageHeader>

      <SharedCard>
        <TicketsTicketForm :model-value="ticket" :cargando="guardando" @submit="onSubmit" />
      </SharedCard>

      <div v-if="can('tickets', 'assign')" class="mt-6">
        <SharedCard titulo="Técnico asignado">
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
      </div>
    </template>
    <p v-else class="text-red-600">Ticket no encontrado</p>
  </div>
</template>