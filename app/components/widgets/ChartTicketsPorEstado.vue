<script setup lang="ts">
const { fetchTickets, fetchCerrados } = useTickets()
const cargando = ref(true)
const total = ref(0)

// Colores de estado validados (accesibilidad CVD) - mismo criterio semántico
// que app/utils/estadoColores.ts (colorTicket). El gris de "cerrado" falla el
// piso de croma del validador a propósito (es el color "neutro/inactivo", no
// una categoría identitaria) - cada porción del donut lleva label directo,
// no depende del color para distinguirse.
const ORDEN_ESTADOS = ['abierto', 'en_proceso', 'esperando_cliente', 'resuelto', 'cerrado'] as const
const categorias = {
  abierto: { name: 'Abierto', color: '#dc2626' },
  en_proceso: { name: 'En proceso', color: '#1075b5' },
  esperando_cliente: { name: 'Esperando cliente', color: '#d97706' },
  resuelto: { name: 'Resuelto', color: '#16a34a' },
  cerrado: { name: 'Cerrado', color: '#57534e' },
}
const data = ref(ORDEN_ESTADOS.map(() => 0))

onMounted(async () => {
  const [activos, cerrados] = await Promise.all([fetchTickets(), fetchCerrados()])
  const porId = new Map(activos.map((t) => [t.id, t]))
  for (const t of cerrados) porId.set(t.id, t)
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
    <p class="text-sm font-semibold text-gray-700 mb-3">Tickets por estado (Servicio técnico)</p>
    <p v-if="cargando" class="text-gray-400 text-sm">Cargando...</p>
    <p v-else-if="!total" class="text-sm text-gray-400">Sin tickets todavía.</p>
    <DonutChart v-else :data="data" :categories="categorias" :radius="100" :height="280" />
  </div>
</template>
