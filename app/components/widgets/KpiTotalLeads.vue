<script setup lang="ts">
const { fetchFunnel } = useReportes()
const cantidad = ref(0)
const cargando = ref(true)

onMounted(async () => {
  const funnel = await fetchFunnel()
  cantidad.value = funnel.reduce((sum, f) => sum + f.total, 0)
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Total leads" :valor="cantidad" :cargando="cargando" icono="📋" />
</template>
