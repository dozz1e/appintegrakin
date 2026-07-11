<script setup lang="ts">
const { fetchFunnel } = useReportes()
const cantidad = ref(0)
const cargando = ref(true)

onMounted(async () => {
  const funnel = await fetchFunnel()
  cantidad.value = funnel.find((f) => f.estado === 'ganado')?.total ?? 0
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Ganados" :valor="cantidad" :cargando="cargando" icono="✅" />
</template>
