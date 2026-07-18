<script setup lang="ts">
const { fetchTickets, fetchCerrados } = useTicketsPostVenta()
const cargando = ref(true)
const total = ref(0)

// Colores de estado validados (accesibilidad CVD) - mismo criterio semántico
// que app/utils/estadoColores.ts (colorTicketPostVenta). pendiente_ingreso y
// despachado comparten el mismo gris ahí también (ambos "neutro/inactivo");
// cada porción del donut lleva label directo, no depende del color para
// distinguirse.
const ORDEN_ESTADOS = [
  'pendiente_ingreso', 'ingreso_equipo', 'probando', 'espera_repuesto', 'listo_despacho', 'despachado', 'desconocido',
] as const
const categorias = {
  pendiente_ingreso: { name: 'Pendiente de ingreso', color: '#57534e' },
  ingreso_equipo: { name: 'Ingreso de equipo', color: '#1075b5' },
  probando: { name: 'Probando', color: '#7c3aed' },
  espera_repuesto: { name: 'Espera de repuesto', color: '#d97706' },
  listo_despacho: { name: 'Listo para despacho', color: '#16a34a' },
  despachado: { name: 'Despachado', color: '#57534e' },
  desconocido: { name: 'Desconocido', color: '#dc2626' },
}
const data = ref(ORDEN_ESTADOS.map(() => 0))

onMounted(async () => {
  const [activos, despachados] = await Promise.all([fetchTickets(), fetchCerrados()])
  const porId = new Map(activos.map((t) => [t.id, t]))
  for (const t of despachados) porId.set(t.id, t)
  const todos = [...porId.values()]
  total.value = todos.length
  const conteo = new Map(ORDEN_ESTADOS.map((e) => [e, 0]))
  for (const t of todos) conteo.set(t.estado, (conteo.get(t.estado) ?? 0) + 1)
  data.value = ORDEN_ESTADOS.map((e) => conteo.get(e) ?? 0)
  cargando.value = false
})
</script>

<template>
  <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
    <p class="text-sm font-semibold text-gray-700 mb-3">Tickets por estado (Post venta)</p>
    <p v-if="cargando" class="text-gray-400 text-sm">Cargando...</p>
    <p v-else-if="!total" class="text-sm text-gray-400">Sin tickets todavía.</p>
    <DonutChart v-else :data="data" :categories="categorias" :radius="100" :height="280" />
  </div>
</template>
