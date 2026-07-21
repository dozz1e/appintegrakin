<script setup lang="ts">
const { fetchLeads, fetchCerrados } = useLeads()
const cantidad = ref(0)
const delta = ref<number | null>(null)
const cargando = ref(true)

onMounted(async () => {
  const [activos, cerrados] = await Promise.all([fetchLeads(), fetchCerrados()])
  const porId = new Map(activos.map((l) => [l.id, l]))
  for (const l of cerrados) porId.set(l.id, l)
  const ganados = [...porId.values()].filter((l) => l.estado === 'ganado')
  cantidad.value = ganados.length
  delta.value = calcularDeltaPct(ganados.map((l) => l.fecha_cierre))
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Leads ganados" :valor="cantidad" :delta="delta" :cargando="cargando" icono="✅" />
</template>
