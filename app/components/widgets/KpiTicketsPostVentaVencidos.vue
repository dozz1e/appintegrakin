<script setup lang="ts">
const { fetchTickets } = useTicketsPostVenta()
const cantidad = ref(0)
const cargando = ref(true)

// Sin delta: "vencidos" es una foto del momento (fecha_tope ya pasada en un
// ticket activo), no un conteo de eventos con timestamp propio para comparar
// entre períodos.
onMounted(async () => {
  const activos = await fetchTickets()
  const ahora = new Date()
  cantidad.value = activos.filter((t) => t.fecha_tope && new Date(t.fecha_tope) < ahora).length
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Vencidos (Post venta)" :valor="cantidad" :cargando="cargando" icono="⏰" />
</template>
