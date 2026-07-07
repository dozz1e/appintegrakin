<script setup lang="ts">
definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'reportes', actions: ['view', 'view_all'] },
})

const { fetchFunnel, fetchPerformance } = useReportes()
const { can } = usePermissions()

const funnel = ref<FunnelItem[]>([])
const performance = ref<PerformanceVendedor[]>([])
const cargando = ref(true)

const labelsEstado: Record<string, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', cotizado: 'Cotizado',
  negociacion: 'Negociación', ganado: 'Ganado', perdido: 'Perdido',
}

onMounted(async () => {
  funnel.value = await fetchFunnel()
  if (can('reportes', 'view_all')) {
    performance.value = await fetchPerformance()
  }
  cargando.value = false
})

const funnelData = computed(() =>
  funnel.value.map((f) => ({ estado: labelsEstado[f.estado] ?? f.estado, total: f.total }))
)
const funnelCategorias = { total: { name: 'Leads', color: '#1075B5' } }
const funnelXFormatter = (i: number) => funnelData.value[i]?.estado ?? ''

const totalLeads = computed(() => funnel.value.reduce((sum, f) => sum + f.total, 0))
const totalGanados = computed(() => funnel.value.find((f) => f.estado === 'ganado')?.total ?? 0)
const totalPerdidos = computed(() => funnel.value.find((f) => f.estado === 'perdido')?.total ?? 0)
const tasaConversion = computed(() => {
  const cerrados = totalGanados.value + totalPerdidos.value
  return cerrados > 0 ? Math.round((totalGanados.value / cerrados) * 100) : 0
})

const performanceData = computed(() =>
  performance.value.map((p) => ({
    vendedor: p.full_name ?? 'Sin nombre',
    leads_ganados: p.leads_ganados,
    tickets_resueltos: p.tickets_resueltos,
  }))
)
const performanceCategorias = {
  leads_ganados: { name: 'Leads ganados', color: '#22c55e' },
  tickets_resueltos: { name: 'Tickets resueltos', color: '#1075B5' },
}
const performanceXFormatter = (i: number) => performanceData.value[i]?.vendedor ?? ''
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Reportes" />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>

    <template v-else>
      <div class="grid grid-cols-4 gap-4 mb-6">
        <SharedCard>
          <p class="text-xs text-gray-400 uppercase">Total leads</p>
          <p class="text-2xl font-semibold text-gray-800">{{ totalLeads }}</p>
        </SharedCard>
        <SharedCard>
          <p class="text-xs text-gray-400 uppercase">Ganados</p>
          <p class="text-2xl font-semibold text-green-600">{{ totalGanados }}</p>
        </SharedCard>
        <SharedCard>
          <p class="text-xs text-gray-400 uppercase">Perdidos</p>
          <p class="text-2xl font-semibold text-red-600">{{ totalPerdidos }}</p>
        </SharedCard>
        <SharedCard>
          <p class="text-xs text-gray-400 uppercase">Tasa de conversión</p>
          <p class="text-2xl font-semibold text-[#1075B5]">{{ tasaConversion }}%</p>
        </SharedCard>
      </div>

      <SharedCard titulo="Funnel de leads" class="mb-6">
        <BarChart
          :data="funnelData"
          :categories="funnelCategorias"
          :height="280"
          :x-formatter="funnelXFormatter"
          x-label="Estado"
          y-label="Leads"
        />
      </SharedCard>

      <SharedCard v-if="can('reportes', 'view_all')" titulo="Performance por vendedor">
        <BarChart
          :data="performanceData"
          :categories="performanceCategorias"
          :height="320"
          :x-formatter="performanceXFormatter"
          x-label="Vendedor"
          y-label="Cantidad"
        />
      </SharedCard>
    </template>
  </div>
</template>