<script setup lang="ts">
const { fetchCerrados } = useTicketsPostVenta()
const cantidad = ref(0)
const delta = ref<number | null>(null)
const cargando = ref(true)

onMounted(async () => {
  const despachados = await fetchCerrados()
  cantidad.value = despachados.length
  delta.value = calcularDeltaPct(despachados.map((t) => t.fecha_despacho))
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Despachados (Post venta)" :valor="cantidad" :delta="delta" :cargando="cargando" icono="🚚" />
</template>
