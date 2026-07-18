<script setup lang="ts">
const { fetchTickets, fetchCerrados } = useTickets()
const cantidad = ref(0)
const cargando = ref(true)

onMounted(async () => {
  const [activos, cerrados] = await Promise.all([fetchTickets(), fetchCerrados()])
  // fetchCerrados no filtra archivado (historial completo) - se une con
  // activos y dedupe por id para no contar dos veces.
  const porId = new Map(activos.map((t) => [t.id, t]))
  for (const t of cerrados) porId.set(t.id, t)
  cantidad.value = porId.size
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Total tickets (Servicio técnico)" :valor="cantidad" :cargando="cargando" icono="🎫" />
</template>
