<script setup lang="ts">
import type { Ticket } from '~/composables/useTickets'
import type { Tecnico } from '~/composables/useTecnicos'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets', actions: ['view', 'view_all'] },
})

const route = useRoute()
const { getTicket, updateTicket, deleteTicket, asignarTecnico } = useTickets()
const { fetchTecnicos } = useTecnicos()
const { fetchProductosDeTicket, agregarProductoATicket, quitarProductoDeTicket } = useTicketProductos()
const { can } = usePermissions()
const { success, error } = useToast()
const user = useSupabaseUser()

const ticket = ref<Ticket | null>(null)
const tecnicos = ref<Tecnico[]>([])
const productosAsociadosIds = ref<string[]>([])
const cargando = ref(true)
const guardando = ref(false)
const asignando = ref(false)
const confirmandoEliminar = ref(false)
const eliminando = ref(false)

const puedeEliminar = computed(() => can('tickets', 'delete') || ticket.value?.owner_id === user.value?.sub)

onMounted(async () => {
  ticket.value = await getTicket(route.params.id as string)
  if (can('tickets', 'assign')) {
    tecnicos.value = await fetchTecnicos()
  }
  const productos = await fetchProductosDeTicket(route.params.id as string)
  productosAsociadosIds.value = productos.map((p) => p.id)
  cargando.value = false
})

const onSubmit = async (payload: Record<string, unknown>, _archivo: File | null, productosIds: string[]) => {
  if (!ticket.value) return
  guardando.value = true
  try {
    ticket.value = await updateTicket(ticket.value.id, payload, ticket.value.version)

    const ticketId = ticket.value.id
    const agregados = productosIds.filter((id) => !productosAsociadosIds.value.includes(id))
    const quitados = productosAsociadosIds.value.filter((id) => !productosIds.includes(id))
    await Promise.all([
      ...agregados.map((id) => agregarProductoATicket(ticketId, id)),
      ...quitados.map((id) => quitarProductoDeTicket(ticketId, id)),
    ])
    productosAsociadosIds.value = productosIds

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

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="p-6 max-w-4xl">
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <template v-else-if="ticket">
      <SharedPageHeader :titulo="ticket.titulo" volver-a="/tickets">
        <template #subtitulo>Creado el {{ formatearFecha(ticket.created_at) }}</template>
        <template #accion>
          <SharedBadge :label="colorTicket(ticket.estado).label" :clases="colorTicket(ticket.estado).clases" tamano="lg" />
        </template>
      </SharedPageHeader>

      <div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 items-start">
        <SharedCard>
          <TicketsTicketForm
            :model-value="ticket"
            :productos-asociados="productosAsociadosIds"
            :cargando="guardando"
            @submit="onSubmit"
          />
        </SharedCard>

        <div class="space-y-6">
          <SharedCard v-if="can('tickets', 'assign')" titulo="Técnico asignado">
            <select
              :value="ticket.tecnico_id ?? ''"
              :disabled="asignando"
              class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
              @change="onAsignar(($event.target as HTMLSelectElement).value)"
            >
              <option value="" disabled>Sin asignar</option>
              <option v-for="t in tecnicos" :key="t.id" :value="t.id">
                {{ t.nombre }}
              </option>
            </select>
          </SharedCard>

          <SharedCard titulo="Imágenes">
            <SharedGaleriaImagenes entidad-tipo="ticket" :entidad-id="ticket.id" />
          </SharedCard>

          <SharedCard v-if="puedeEliminar">
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
