<script setup lang="ts">
const { fetchTickets } = useTicketsPostVenta()
const cargando = ref(true)
const totalActivos = ref(0)

// Vencidos vs a tiempo, solo entre los activos (los despachados ya no
// "vencen"). Rojo/verde se evita a propósito (peor caso de daltonismo
// rojo-verde) - se usa rojo vs azul primario, validado.
const categorias = {
  vencido: { name: 'Vencido', color: '#dc2626' },
  a_tiempo: { name: 'A tiempo', color: '#1075b5' },
}
const data = ref([0, 0])

onMounted(async () => {
  const activos = await fetchTickets()
  totalActivos.value = activos.length
  const ahora = new Date()
  let vencido = 0
  let aTiempo = 0
  for (const t of activos) {
    if (t.fecha_tope && new Date(t.fecha_tope) < ahora) vencido++
    else aTiempo++
  }
  data.value = [vencido, aTiempo]
  cargando.value = false
})
</script>

<template>
  <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
    <p class="text-sm font-semibold text-gray-700 mb-3">Vencidos vs a tiempo, activos (Post venta)</p>
    <p v-if="cargando" class="text-gray-400 text-sm">Cargando...</p>
    <p v-else-if="!totalActivos" class="text-sm text-gray-400">Sin tickets activos.</p>
    <DonutChart v-else :data="data" :categories="categorias" :radius="100" :height="280" />
  </div>
</template>
