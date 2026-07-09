<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'
import type { Ticket } from '~/composables/useTickets'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'clientes', actions: ['view', 'view_all'] },
})

const route = useRoute()
const { getCliente, updateCliente, deleteCliente } = useClientes()
const { fetchTicketsPorCliente } = useTickets()
const { can } = usePermissions()
const { success, error } = useToast()

const cliente = ref<Cliente | null>(null)
const tickets = ref<Ticket[]>([])
const cargando = ref(true)
const guardando = ref(false)
const confirmandoEliminar = ref(false)
const eliminando = ref(false)

onMounted(async () => {
  cliente.value = await getCliente(route.params.id as string)
  if (can('tickets', 'view') || can('tickets', 'view_all')) {
    tickets.value = await fetchTicketsPorCliente(cliente.value.id)
  }
  cargando.value = false
})

const onSubmit = async (payload: Record<string, unknown>) => {
  if (!cliente.value) return
  guardando.value = true
  try {
    cliente.value = await updateCliente(cliente.value.id, payload, cliente.value.version)
    success('Cliente actualizado')
  } catch (e: any) {
    if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este cliente mientras lo tenías abierto. Se recargaron los datos actuales, revisa e intenta de nuevo.')
      cliente.value = await getCliente(route.params.id as string)
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  } finally {
    guardando.value = false
  }
}

async function onConfirmarEliminar() {
  if (!cliente.value) return
  eliminando.value = true
  try {
    await deleteCliente(cliente.value.id)
    success('Cliente eliminado')
    await navigateTo('/clientes')
  } catch (e: any) {
    if (e.code === '23503') {
      error('No se puede eliminar: el cliente tiene leads o tickets asociados. Resuélvelos primero.')
    } else {
      error('No se pudo eliminar el cliente. Intenta de nuevo.')
    }
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-lg">
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <template v-else-if="cliente">
      <SharedPageHeader :titulo="cliente.razon_social" volver-a="/clientes" />

      <SharedCard>
        <ClientesClienteForm
          :model-value="cliente"
          :cargando="guardando"
          @submit="can('clientes', 'edit') ? onSubmit($event) : undefined"
        />
      </SharedCard>

      <div v-if="can('clientes', 'delete')" class="mt-6">
        <SharedCard>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold text-gray-700">Eliminar cliente</h2>
              <p class="text-xs text-gray-400 mt-1">Esta acción no se puede deshacer.</p>
            </div>
            <button
              type="button"
              class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              @click="confirmandoEliminar = true"
            >
              Eliminar cliente
            </button>
          </div>
        </SharedCard>
      </div>

      <div v-if="can('tickets', 'view') || can('tickets', 'view_all')" class="mt-6">
        <SharedCard>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-gray-700">Tickets de servicio técnico</h2>
            <NuxtLink
              v-if="can('tickets', 'create')"
              :to="`/tickets/nuevo?cliente_id=${cliente.id}`"
              class="text-xs text-[#1075B5] hover:underline font-medium"
            >
              + Nuevo ticket
            </NuxtLink>
          </div>
          <ul v-if="tickets.length" class="space-y-2">
            <li
              v-for="t in tickets"
              :key="t.id"
              class="text-sm border border-gray-100 rounded-xl p-3 flex items-center justify-between"
            >
              <NuxtLink :to="`/tickets/${t.id}`" class="hover:underline text-gray-700 font-medium">
                {{ t.titulo }}
              </NuxtLink>
              <SharedBadge :label="colorTicket(t.estado).label" :clases="colorTicket(t.estado).clases" />
            </li>
          </ul>
          <p v-else class="text-sm text-gray-400">Sin tickets todavía</p>
        </SharedCard>
      </div>

      <SharedConfirmDialog
        :open="confirmandoEliminar"
        titulo="Eliminar cliente"
        :mensaje="`¿Eliminar a ${cliente.razon_social}? Esta acción no se puede deshacer.`"
        :cargando="eliminando"
        @confirmar="onConfirmarEliminar"
        @cancelar="confirmandoEliminar = false"
      />
    </template>
    <p v-else class="text-red-600">Cliente no encontrado</p>
  </div>
</template>
