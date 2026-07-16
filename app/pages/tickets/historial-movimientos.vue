<!-- app/pages/tickets/historial-movimientos.vue -->
<script setup lang="ts">
import type { HistorialEstadoRow } from '~/composables/useHistorialEstados'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets', actions: ['view', 'view_all'] },
})

interface FilaHistorial extends HistorialEstadoRow {
  ticket_titulo: string
}

const { fetchHistorial } = useHistorialEstados()
const { fetchTicketsPorIds } = useTickets()

const filas = ref<FilaHistorial[]>([])
const cargando = ref(true)

onMounted(async () => {
  const historial = await fetchHistorial('ticket')
  const ids = [...new Set(historial.map((h) => h.entidad_id))]
  const tickets = await fetchTicketsPorIds(ids)
  const tituloPorId = new Map(tickets.map((t) => [t.id, t.titulo]))
  filas.value = historial.map((h) => ({ ...h, ticket_titulo: tituloPorId.get(h.entidad_id) ?? 'Ticket eliminado' }))
  cargando.value = false
})

function formatearFechaHora(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Historial de movimientos — Tickets" />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="!filas.length" class="p-10 text-center text-gray-400">Sin movimientos registrados todavía.</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Ticket</th>
            <th class="px-4 py-3 font-medium">De</th>
            <th class="px-4 py-3 font-medium">A</th>
            <th class="px-4 py-3 font-medium">Usuario</th>
            <th class="px-4 py-3 font-medium">Fecha</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="f in filas" :key="f.id">
            <td class="px-4 py-3 text-gray-700 font-medium">
              <NuxtLink :to="`/tickets/${f.entidad_id}`" class="hover:underline">{{ f.ticket_titulo }}</NuxtLink>
            </td>
            <td class="px-4 py-3">
              <SharedBadge v-if="f.estado_anterior" :label="colorTicket(f.estado_anterior).label" :clases="colorTicket(f.estado_anterior).clases" />
              <span v-else class="text-gray-400">—</span>
            </td>
            <td class="px-4 py-3">
              <SharedBadge :label="colorTicket(f.estado_nuevo).label" :clases="colorTicket(f.estado_nuevo).clases" />
            </td>
            <td class="px-4 py-3 text-gray-500">{{ f.usuario_nombre ?? '—' }}</td>
            <td class="px-4 py-3 text-gray-500">{{ formatearFechaHora(f.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
