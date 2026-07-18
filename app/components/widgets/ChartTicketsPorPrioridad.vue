<script setup lang="ts">
const { fetchTickets } = useTickets()
const cargando = ref(true)
const totalActivos = ref(0)

const LABEL_PRIORIDAD: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente' }
const ORDEN_PRIORIDAD = ['baja', 'media', 'alta', 'urgente'] as const
const categorias = { cantidad: { name: 'Tickets', color: '#1075b5' } }
const data = ref(ORDEN_PRIORIDAD.map((p) => ({ prioridad: p, cantidad: 0 })))
const xFormatter = (i: number) => LABEL_PRIORIDAD[data.value[i]?.prioridad] ?? ''

onMounted(async () => {
  const activos = await fetchTickets()
  totalActivos.value = activos.length
  const conteo = new Map(ORDEN_PRIORIDAD.map((p) => [p, 0]))
  for (const t of activos) conteo.set(t.prioridad, (conteo.get(t.prioridad) ?? 0) + 1)
  data.value = ORDEN_PRIORIDAD.map((p) => ({ prioridad: p, cantidad: conteo.get(p) ?? 0 }))
  cargando.value = false
})
</script>

<template>
  <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
    <p class="text-sm font-semibold text-gray-700 mb-3">Tickets por prioridad, activos (Servicio técnico)</p>
    <p v-if="cargando" class="text-gray-400 text-sm">Cargando...</p>
    <p v-else-if="!totalActivos" class="text-sm text-gray-400">Sin tickets activos.</p>
    <BarChart
      v-else
      :data="data"
      :categories="categorias"
      :y-axis="['cantidad']"
      :height="280"
      :x-formatter="xFormatter"
      :hide-legend="true"
    />
  </div>
</template>
