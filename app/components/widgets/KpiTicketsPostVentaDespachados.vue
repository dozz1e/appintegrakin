<script setup lang="ts">
const { fetchCerrados } = useTicketsPostVenta()
const cantidad = ref(0)
const cargando = ref(true)

onMounted(async () => {
  const despachados = await fetchCerrados()
  cantidad.value = despachados.length
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Despachados (Post venta)" :valor="cantidad" :cargando="cargando" icono="🚚" />
</template>
