<script setup lang="ts">
const { fetchFunnel } = useReportes()
const tasa = ref('0%')
const cargando = ref(true)

onMounted(async () => {
  const funnel = await fetchFunnel()
  const ganados = funnel.find((f) => f.estado === 'ganado')?.total ?? 0
  const perdidos = funnel.find((f) => f.estado === 'perdido')?.total ?? 0
  const cerrados = ganados + perdidos
  tasa.value = cerrados > 0 ? `${Math.round((ganados / cerrados) * 100)}%` : '—'
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Tasa de conversión" :valor="tasa" :cargando="cargando" icono="📈" />
</template>