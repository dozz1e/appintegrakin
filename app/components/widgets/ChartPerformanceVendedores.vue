<script setup lang="ts">
const { fetchPerformance } = useReportes()
const { can } = usePermissions()

const performance = ref<PerformanceVendedor[]>([])
const cargando = ref(true)

onMounted(async () => {
  if (can('reportes', 'view_all')) {
    performance.value = await fetchPerformance()
  }
  cargando.value = false
})

const performanceData = computed(() =>
  performance.value
    .map((p) => ({ vendedor: p.full_name ?? 'Sin nombre', leads_ganados: p.leads_ganados }))
    .sort((a, b) => b.leads_ganados - a.leads_ganados)
)
const categorias = {
  leads_ganados: { name: 'Leads ganados', color: '#16a34a' },
}
const xFormatter = (i: number) => performanceData.value[i]?.vendedor ?? ''
</script>

<template>
  <div v-if="can('reportes', 'view_all')" class="bg-surface border border-border rounded-2xl shadow-sm p-4">
    <p class="text-sm font-semibold text-ink mb-3">Performance por vendedor</p>
    <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>
    <p v-else-if="!performanceData.length" class="text-sm text-ink-muted">Sin datos todavía.</p>
    <BarChart
      v-else
      :data="performanceData"
      :categories="categorias"
      :y-axis="['leads_ganados']"
      :height="320"
      :x-formatter="xFormatter"
      x-label="Vendedor"
      y-label="Leads ganados"
    />
  </div>
</template>
