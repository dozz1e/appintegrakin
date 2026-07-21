<script setup lang="ts">
const { fetchTickets, fetchCerrados } = useTicketsPostVenta()
const cantidad = ref(0)
const delta = ref<number | null>(null)
const cargando = ref(true)

onMounted(async () => {
  const [activos, despachados] = await Promise.all([fetchTickets(), fetchCerrados()])
  const porId = new Map(activos.map((t) => [t.id, t]))
  for (const t of despachados) porId.set(t.id, t)
  const todos = [...porId.values()]
  cantidad.value = todos.length
  delta.value = calcularDeltaPct(todos.map((t) => t.created_at))
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Total tickets (Post venta)" :valor="cantidad" :delta="delta" :cargando="cargando" icono="📦" />
</template>
