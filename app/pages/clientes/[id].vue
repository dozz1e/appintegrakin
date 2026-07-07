<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'
import type { Ticket } from '~/composables/useTickets'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'clientes', actions: ['view', 'view_all'] },
})

const route = useRoute()
const { getCliente, updateCliente } = useClientes()
const { fetchTicketsPorCliente } = useTickets()
const { can } = usePermissions()
const { success, error } = useToast()

const cliente = ref<Cliente | null>(null)
const tickets = ref<Ticket[]>([])
const cargando = ref(true)
const guardando = ref(false)

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
    cliente.value = await updateCliente(cliente.value.id, payload)
    success('Cliente actualizado')
  } catch (e) {
    error('No se pudo guardar el cambio. Intenta de nuevo.')
  } finally {
    guardando.value = false
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
    </template>
    <p v-else class="text-red-600">Cliente no encontrado</p>
  </div>
</template>
