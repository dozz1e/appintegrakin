<script setup lang="ts">
const { fetchFunnel } = useReportes()
const funnel = ref<FunnelItem[]>([])
const cargando = ref(true)

const labelsEstado: Record<string, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', cotizado: 'Cotizado',
  negociacion: 'Negociación', ganado: 'Ganado', perdido: 'Perdido',
}

onMounted(async () => {
  funnel.value = await fetchFunnel()
  cargando.value = false
})

const funnelData = computed(() =>
  funnel.value.map((f) => ({ estado: labelsEstado[f.estado] ?? f.estado, total: f.total }))
)
const categorias = { total: { name: 'Leads', color: '#1075B5' } }
const xFormatter = (i: number) => funnelData.value[i]?.estado ?? ''
</script>

<template>
  <div class="border rounded-lg p-4">
    <p class="text-xs text-gray-500 mb-3">Funnel de leads</p>
    <p v-if="cargando" class="text-gray-400 text-sm">Cargando...</p>
    <BarChart
      v-else
      :data="funnelData"
      :categories="categorias"
      :y-axis="['total']"
      :height="280"
      :x-formatter="xFormatter"
      x-label="Estado"
      y-label="Leads"
    />
  </div>
</template>
