<script setup lang="ts">
const { fetchLeads, fetchCerrados } = useLeads()
const cantidad = ref(0)
const delta = ref<number | null>(null)
const cargando = ref(true)

onMounted(async () => {
  const [activos, cerrados] = await Promise.all([fetchLeads(), fetchCerrados()])
  // fetchCerrados no filtra archivado (historial completo) - se une con
  // activos y dedupe por id para no contar dos veces.
  const porId = new Map(activos.map((l) => [l.id, l]))
  for (const l of cerrados) porId.set(l.id, l)
  const todos = [...porId.values()]
  cantidad.value = todos.length
  delta.value = calcularDeltaPct(todos.map((l) => l.created_at))
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Total leads" :valor="cantidad" :delta="delta" :cargando="cargando" icono="📋" />
</template>
