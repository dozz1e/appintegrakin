<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'
import type { Ticket } from '~/composables/useTickets'

const props = defineProps<{ clientes: Cliente[] }>()
const emit = defineEmits<{ eliminar: [cliente: Cliente] }>()

const { fetchTicketsPorCliente } = useTickets()
const { can } = usePermissions()

const busqueda = ref('')
const seleccionadoId = ref<string | null>(null)
const ticketsSeleccionado = ref<Ticket[]>([])
const tabActiva = ref<'info' | 'tickets'>('info')

const puedeVerTickets = computed(() => can('tickets', 'view') || can('tickets', 'view_all'))

const clientesFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return props.clientes
  return props.clientes.filter(
    (c) => c.razon_social.toLowerCase().includes(q) || (c.nombre_contacto ?? '').toLowerCase().includes(q)
  )
})

const seleccionado = computed(() => props.clientes.find((c) => c.id === seleccionadoId.value) ?? null)

const totalTickets = computed(() => ticketsSeleccionado.value.length)
const ticketsAbiertos = computed(() => ticketsSeleccionado.value.filter((t) => t.estado !== 'cerrado').length)
const ticketsResueltos = computed(() => ticketsSeleccionado.value.filter((t) => t.estado === 'resuelto').length)

watch(seleccionadoId, async (id) => {
  tabActiva.value = 'info'
  ticketsSeleccionado.value = []
  if (id && puedeVerTickets.value) {
    ticketsSeleccionado.value = await fetchTicketsPorCliente(id)
  }
})

function seleccionar(c: Cliente) {
  seleccionadoId.value = c.id
}
</script>

<template>
  <div class="flex gap-4 items-start">
    <div class="w-72 shrink-0 bg-white border border-gray-100 rounded-2xl shadow-sm p-3 max-h-[70vh] overflow-y-auto">
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar cliente..."
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
      <ul class="space-y-1">
        <li
          v-for="c in clientesFiltrados"
          :key="c.id"
          class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors"
          :class="c.id === seleccionadoId ? 'bg-[#EAF4FA]' : 'hover:bg-gray-50'"
          @click="seleccionar(c)"
        >
          <SharedAvatar :nombre="c.razon_social" size="sm" />
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate">{{ c.razon_social }}</p>
            <p v-if="c.nombre_contacto" class="text-xs text-gray-400 truncate">{{ c.nombre_contacto }}</p>
          </div>
        </li>
      </ul>
      <p v-if="!clientesFiltrados.length" class="text-sm text-gray-400 text-center py-4">Sin resultados</p>
    </div>

    <div
      v-if="!seleccionado"
      class="flex-1 min-w-0 bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400"
    >
      Selecciona un cliente de la lista para ver su detalle.
    </div>

    <div v-else class="flex-1 min-w-0">
      <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <div class="flex items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-3">
            <SharedAvatar :nombre="seleccionado.razon_social" size="md" />
            <div>
              <h2 class="text-lg font-semibold text-gray-800">{{ seleccionado.razon_social }}</h2>
              <p v-if="seleccionado.nombre_contacto" class="text-xs text-gray-400">{{ seleccionado.nombre_contacto }}</p>
            </div>
          </div>
          <button
            v-if="can('clientes', 'delete')"
            type="button"
            class="text-red-600 hover:underline text-sm font-medium shrink-0"
            @click="emit('eliminar', seleccionado)"
          >
            Eliminar
          </button>
        </div>

        <div v-if="puedeVerTickets" class="grid grid-cols-3 gap-3 mb-4">
          <div class="bg-gray-50 rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400">Total tickets</p>
            <p class="text-xl font-semibold text-gray-800">{{ totalTickets }}</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400">Abiertos</p>
            <p class="text-xl font-semibold text-gray-800">{{ ticketsAbiertos }}</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400">Resueltos</p>
            <p class="text-xl font-semibold text-gray-800">{{ ticketsResueltos }}</p>
          </div>
        </div>

        <div class="flex gap-4 border-b border-gray-100 mb-4">
          <button
            type="button"
            class="text-sm font-medium pb-2 border-b-2 transition-colors"
            :class="tabActiva === 'info' ? 'border-[#1075B5] text-[#1075B5]' : 'border-transparent text-gray-400 hover:text-gray-600'"
            @click="tabActiva = 'info'"
          >
            Información
          </button>
          <button
            v-if="puedeVerTickets"
            type="button"
            class="text-sm font-medium pb-2 border-b-2 transition-colors"
            :class="tabActiva === 'tickets' ? 'border-[#1075B5] text-[#1075B5]' : 'border-transparent text-gray-400 hover:text-gray-600'"
            @click="tabActiva = 'tickets'"
          >
            Tickets
          </button>
        </div>

        <div v-if="tabActiva === 'info'" class="space-y-4">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-xs text-gray-400 mb-1">RUT</p>
              <p class="text-gray-700">{{ seleccionado.rut || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Nombre de contacto</p>
              <p class="text-gray-700">{{ seleccionado.nombre_contacto || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Teléfono</p>
              <p class="text-gray-700">{{ seleccionado.telefono || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Email</p>
              <p class="text-gray-700">{{ seleccionado.email || '—' }}</p>
            </div>
          </div>

          <NuxtLink
            :to="`/clientes/${seleccionado.id}`"
            class="inline-flex items-center gap-1 text-sm text-[#1075B5] hover:underline font-medium"
          >
            <Icon name="mdi:pencil-outline" class="w-4 h-4" />
            {{ can('clientes', 'edit') ? 'Editar cliente' : 'Ver detalle' }}
          </NuxtLink>
        </div>

        <div v-else>
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-semibold text-gray-700">Tickets de servicio técnico</p>
            <NuxtLink
              v-if="can('tickets', 'create')"
              :to="`/tickets/nuevo?cliente_id=${seleccionado.id}`"
              class="text-xs text-[#1075B5] hover:underline font-medium"
            >
              + Nuevo ticket
            </NuxtLink>
          </div>
          <ul v-if="ticketsSeleccionado.length" class="space-y-2">
            <li
              v-for="t in ticketsSeleccionado"
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
        </div>
      </div>
    </div>

    <div v-if="seleccionado" class="w-80 shrink-0">
      <SharedTareaList entidad-tipo="cliente" :entidad-id="seleccionado.id" />
    </div>
  </div>
</template>
