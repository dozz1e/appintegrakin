<!-- app/pages/post-venta/historial-movimientos.vue -->
<script setup lang="ts">
import type { HistorialEstadoRow } from '~/composables/useHistorialEstados'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets_post_venta', actions: ['view'] },
})

interface FilaHistorial extends HistorialEstadoRow {
  n_guia: string
}

const { fetchHistorial } = useHistorialEstados()
const { fetchTicketsPorIds } = useTicketsPostVenta()

const filas = ref<FilaHistorial[]>([])
const cargando = ref(true)

onMounted(async () => {
  const historial = await fetchHistorial('ticket_post_venta')
  const ids = [...new Set(historial.map((h) => h.entidad_id))]
  const tickets = await fetchTicketsPorIds(ids)
  const guiaPorId = new Map(tickets.map((t) => [t.id, t.n_guia]))
  filas.value = historial
    .filter((h) => guiaPorId.has(h.entidad_id))
    .map((h) => ({ ...h, n_guia: guiaPorId.get(h.entidad_id)! }))
  cargando.value = false
})

function formatearFechaHora(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Historial de movimientos — Post Venta" />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="!filas.length" class="p-10 text-center text-gray-400">Sin movimientos registrados todavía.</div>
      <div v-else class="hidden lg:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
              <th class="px-4 py-3 font-medium">Guía</th>
              <th class="px-4 py-3 font-medium">De</th>
              <th class="px-4 py-3 font-medium">A</th>
              <th class="px-4 py-3 font-medium">Usuario</th>
              <th class="px-4 py-3 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr v-for="f in filas" :key="f.id">
              <td class="px-4 py-3 text-gray-700 font-medium">
                <NuxtLink :to="`/post-venta/${f.entidad_id}`" class="hover:underline">{{ f.n_guia }}</NuxtLink>
              </td>
              <td class="px-4 py-3">
                <SharedBadge v-if="f.estado_anterior" :label="colorTicketPostVenta(f.estado_anterior).label" :clases="colorTicketPostVenta(f.estado_anterior).clases" />
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-4 py-3">
                <SharedBadge :label="colorTicketPostVenta(f.estado_nuevo).label" :clases="colorTicketPostVenta(f.estado_nuevo).clases" />
              </td>
              <td class="px-4 py-3 text-gray-500">{{ f.usuario_nombre ?? '—' }}</td>
              <td class="px-4 py-3 text-gray-500">{{ formatearFechaHora(f.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="filas.length" class="lg:hidden divide-y divide-gray-50">
        <div v-for="f in filas" :key="f.id" class="p-4">
          <div class="flex items-center justify-between gap-2">
            <NuxtLink :to="`/post-venta/${f.entidad_id}`" class="font-medium text-gray-700 truncate hover:underline">
              {{ f.n_guia }}
            </NuxtLink>
            <SharedBadge :label="colorTicketPostVenta(f.estado_nuevo).label" :clases="colorTicketPostVenta(f.estado_nuevo).clases" />
          </div>
          <p class="text-xs text-gray-500 mt-1">
            <span v-if="f.estado_anterior">Desde {{ colorTicketPostVenta(f.estado_anterior).label }} · </span>{{ f.usuario_nombre ?? '—' }} · {{ formatearFechaHora(f.created_at) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
