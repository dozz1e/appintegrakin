<script setup lang="ts">
const { fetchClientes } = useClientes()
const cantidad = ref(0)
const delta = ref<number | null>(null)
const cargando = ref(true)

onMounted(async () => {
  const clientes = await fetchClientes()
  cantidad.value = clientes.length
  delta.value = calcularDeltaPct(clientes.map((c) => c.created_at))
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Clientes totales" :valor="cantidad" :delta="delta" :cargando="cargando" icono="🏢" />
</template>
