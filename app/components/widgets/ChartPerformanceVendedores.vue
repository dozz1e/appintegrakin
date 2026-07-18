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
  performance.value.map((p) => ({
    vendedor: p.full_name ?? 'Sin nombre',
    leads_ganados: p.leads_ganados,
  }))
)
const categorias = {
  leads_ganados: { name: 'Leads ganados', color: '#22c55e' },
}
const xFormatter = (i: number) => performanceData.value[i]?.vendedor ?? ''
</script>

<template>
  <div v-if="can('reportes', 'view_all')" class="border rounded-lg p-4">
    <p class="text-xs text-gray-500 mb-3">Performance por vendedor</p>
    <p v-if="cargando" class="text-gray-400 text-sm">Cargando...</p>
    <BarChart
      v-else
      :data="performanceData"
      :categories="categorias"
      :y-axis="['leads_ganados']"
      :height="320"
      :x-formatter="xFormatter"
      x-label="Vendedor"
      y-label="Cantidad"
    />
  </div>
</template>
