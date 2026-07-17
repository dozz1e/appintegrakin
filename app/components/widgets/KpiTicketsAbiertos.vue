<script setup lang="ts">
const { fetchTickets } = useTickets()
const cantidad = ref(0)
const cargando = ref(true)

onMounted(async () => {
  const tickets = await fetchTickets()
  cantidad.value = tickets.filter((t) => t.estado !== 'cerrado').length
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Tickets abiertos (Servicio técnico)" :valor="cantidad" :cargando="cargando" icono="🎫" />
</template>
