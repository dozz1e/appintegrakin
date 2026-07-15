<!-- app/pages/tickets/cerrados.vue -->
<script setup lang="ts">
import type { Ticket } from '~/composables/useTickets'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets', actions: ['view', 'view_all'] },
})

const { fetchCerrados } = useTickets()

const tickets = ref<Ticket[]>([])
const cargando = ref(true)

onMounted(async () => {
  tickets.value = await fetchCerrados()
  cargando.value = false
})

function formatearFecha(fecha: string | null) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Historial de cerrados — Tickets" />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="!tickets.length" class="p-10 text-center text-gray-400">Sin tickets cerrados todavía.</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Título</th>
            <th class="px-4 py-3 font-medium">Cliente</th>
            <th class="px-4 py-3 font-medium">Estado final</th>
            <th class="px-4 py-3 font-medium">Fecha de cierre</th>
            <th class="px-4 py-3 font-medium">Archivado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="t in tickets" :key="t.id" class="cursor-pointer hover:bg-gray-50" @click="navigateTo(`/tickets/${t.id}`)">
            <td class="px-4 py-3 text-gray-700 font-medium">{{ t.titulo }}</td>
            <td class="px-4 py-3 text-gray-500">{{ t.clientes?.razon_social ?? '—' }}</td>
            <td class="px-4 py-3"><SharedBadge :label="colorTicket(t.estado).label" :clases="colorTicket(t.estado).clases" /></td>
            <td class="px-4 py-3 text-gray-500">{{ formatearFecha(t.fecha_cierre) }}</td>
            <td class="px-4 py-3 text-gray-500">{{ t.archivado ? 'Sí' : 'No (aún visible en el listado activo)' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
