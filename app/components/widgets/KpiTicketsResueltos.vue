<script setup lang="ts">
const { fetchCerrados } = useTickets()
const cantidad = ref(0)
const cargando = ref(true)

onMounted(async () => {
  const cerrados = await fetchCerrados()
  cantidad.value = cerrados.filter((t) => t.estado === 'resuelto').length
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Resueltos (Servicio técnico)" :valor="cantidad" :cargando="cargando" icono="✅" />
</template>
