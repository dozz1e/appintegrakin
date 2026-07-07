<script setup lang="ts">
const { fetchLeads } = useLeads()
const tasa = ref('0%')
const cargando = ref(true)

onMounted(async () => {
  const leads = await fetchLeads()
  const ganados = leads.filter((l) => l.estado === 'ganado').length
  const perdidos = leads.filter((l) => l.estado === 'perdido').length
  const cerrados = ganados + perdidos
  tasa.value = cerrados > 0 ? `${Math.round((ganados / cerrados) * 100)}%` : '—'
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Tasa de conversión" :valor="tasa" :cargando="cargando" icono="📈" />
</template>