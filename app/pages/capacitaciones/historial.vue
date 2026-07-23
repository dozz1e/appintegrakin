<!-- app/pages/capacitaciones/historial.vue -->
<script setup lang="ts">
import type { CitaCapacitacionConNombres } from '~/composables/useCitasCapacitacion'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'capacitaciones', actions: ['view', 'view_all'] },
})

const { fetchCitasCerradas } = useCitasCapacitacion()

const citas = ref<CitaCapacitacionConNombres[]>([])
const cargando = ref(true)
const busqueda = ref('')
const idsNotasAbiertas = ref<Set<string>>(new Set())

onMounted(async () => {
  citas.value = await fetchCitasCerradas()
  cargando.value = false
})

const citasFiltradas = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return citas.value
  return citas.value.filter(
    (c) => c.cliente_nombre.toLowerCase().includes(q) || c.producto_nombre.toLowerCase().includes(q) || c.titulo.toLowerCase().includes(q)
  )
})

function toggleNotas(id: string) {
  const abiertas = new Set(idsNotasAbiertas.value)
  if (abiertas.has(id)) abiertas.delete(id)
  else abiertas.add(id)
  idsNotasAbiertas.value = abiertas
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Historial de capacitaciones" volver-a="/capacitaciones" />

    <input
      v-model="busqueda"
      type="text"
      placeholder="Buscar por cliente, producto o título..."
      class="w-full max-w-md border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
    />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="!citasFiltradas.length" class="p-10 text-center text-gray-400">Sin capacitaciones cerradas todavía.</div>
      <ul v-else class="divide-y divide-gray-50">
        <li v-for="c in citasFiltradas" :key="c.id">
          <button
            type="button"
            class="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50"
            @click="toggleNotas(c.id)"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-800">{{ c.cliente_nombre }} — {{ c.producto_nombre }}</p>
              <p class="text-xs text-gray-400">{{ formatearFecha(c.fecha_hora) }} · {{ c.titulo }}</p>
            </div>
            <div class="flex items-center gap-2">
              <SharedBadge :label="colorCitaCapacitacion(c.estado).label" :clases="colorCitaCapacitacion(c.estado).clases" />
              <Icon name="mdi:chevron-down" class="w-4 h-4 text-gray-400 transition-transform" :class="idsNotasAbiertas.has(c.id) ? 'rotate-180' : ''" />
            </div>
          </button>
          <div v-if="idsNotasAbiertas.has(c.id)" class="border-t border-gray-100 bg-gray-50/60 p-4">
            <CapacitacionesCapacitacionNotasTimeline :cita-id="c.id" />
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
