<script setup lang="ts">
const { fetchTickets, fetchCerrados } = useTicketsPostVenta()
const cantidad = ref(0)
const cargando = ref(true)

onMounted(async () => {
  const [activos, despachados] = await Promise.all([fetchTickets(), fetchCerrados()])
  const porId = new Map(activos.map((t) => [t.id, t]))
  for (const t of despachados) porId.set(t.id, t)
  cantidad.value = porId.size
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Total tickets (Post venta)" :valor="cantidad" :cargando="cargando" icono="📦" />
</template>
