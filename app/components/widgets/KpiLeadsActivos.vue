<script setup lang="ts">
const { fetchLeads } = useLeads()
const cantidad = ref(0)
const cargando = ref(true)

onMounted(async () => {
  const leads = await fetchLeads()
  cantidad.value = leads.filter((l) => !['ganado', 'perdido'].includes(l.estado)).length
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Leads activos" :valor="cantidad" :cargando="cargando" icono="🧲" />
</template>
