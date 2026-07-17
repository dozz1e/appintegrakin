<script setup lang="ts">
const { fetchTickets } = useTicketsPostVenta()
const cantidad = ref(0)
const cargando = ref(true)

onMounted(async () => {
  const tickets = await fetchTickets()
  cantidad.value = tickets.filter((t) => t.estado !== 'despachado').length
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Tickets abiertos (Post venta)" :valor="cantidad" :cargando="cargando" icono="📦" />
</template>
