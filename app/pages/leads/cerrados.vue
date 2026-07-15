<!-- app/pages/leads/cerrados.vue -->
<script setup lang="ts">
import type { Lead } from '~/composables/useLeads'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'leads', actions: ['view', 'view_all'] },
})

const { fetchCerrados } = useLeads()

const leads = ref<Lead[]>([])
const cargando = ref(true)

onMounted(async () => {
  leads.value = await fetchCerrados()
  cargando.value = false
})

function formatearFecha(fecha: string | null) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Historial de cerrados — Leads" />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="!leads.length" class="p-10 text-center text-gray-400">Sin leads cerrados todavía.</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Nombre</th>
            <th class="px-4 py-3 font-medium">Estado final</th>
            <th class="px-4 py-3 font-medium">Fecha de cierre</th>
            <th class="px-4 py-3 font-medium">Archivado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="l in leads" :key="l.id" class="cursor-pointer hover:bg-gray-50" @click="navigateTo(`/leads/${l.id}`)">
            <td class="px-4 py-3 text-gray-700 font-medium">{{ l.nombre }}</td>
            <td class="px-4 py-3"><SharedBadge :label="colorLead(l.estado).label" :clases="colorLead(l.estado).clases" /></td>
            <td class="px-4 py-3 text-gray-500">{{ formatearFecha(l.fecha_cierre) }}</td>
            <td class="px-4 py-3 text-gray-500">{{ l.archivado ? 'Sí' : 'No (aún visible en el listado activo)' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
