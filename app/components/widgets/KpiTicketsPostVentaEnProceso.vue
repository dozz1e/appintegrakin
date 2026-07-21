<script setup lang="ts">
const { fetchTickets } = useTicketsPostVenta()
const cantidad = ref(0)
const cargando = ref(true)

// Sin delta - foto del momento, igual que Vencidos.
onMounted(async () => {
  const activos = await fetchTickets()
  const ahora = new Date()
  cantidad.value = activos.filter((t) => !(t.fecha_tope && new Date(t.fecha_tope) < ahora)).length
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="En proceso (Post venta)" :valor="cantidad" :cargando="cargando" icono="🔧" />
</template>
