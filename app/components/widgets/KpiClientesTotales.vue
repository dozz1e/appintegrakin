<script setup lang="ts">
const { fetchClientes } = useClientes()
const cantidad = ref(0)
const cargando = ref(true)

onMounted(async () => {
  const clientes = await fetchClientes()
  cantidad.value = clientes.length
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Clientes totales" :valor="cantidad" :cargando="cargando" icono="🏢" />
</template>
