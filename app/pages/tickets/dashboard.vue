<!-- app/pages/tickets/dashboard.vue -->
<script setup lang="ts">
import type { Ticket } from '~/composables/useTickets'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets', actions: ['view', 'view_all'] },
})

const { fetchTickets, fetchCerrados } = useTickets()

const activos = ref<Ticket[]>([])
const todos = ref<Ticket[]>([])
const cargando = ref(true)

onMounted(async () => {
  const [act, cerrados] = await Promise.all([fetchTickets(), fetchCerrados()])
  activos.value = act
  // fetchCerrados no filtra archivado (incluye historial completo); fetchTickets
  // sí (solo activos) - se unen y deduplican por id para tener el universo
  // completo de tickets (activos + cerrados/archivados) sin contarlos dos veces.
  const porId = new Map(act.map((t) => [t.id, t]))
  for (const t of cerrados) porId.set(t.id, t)
  todos.value = [...porId.values()]
  cargando.value = false
})

const totalTickets = computed(() => todos.value.length)
const ticketsAbiertos = computed(() => activos.value.filter((t) => t.estado !== 'cerrado').length)
const ticketsResueltos = computed(() => todos.value.filter((t) => t.estado === 'resuelto').length)
const ticketsCerrados = computed(() => todos.value.filter((t) => t.estado === 'cerrado').length)

// Colores de estado validados (accesibilidad CVD) - mismo criterio semántico
// que app/utils/estadoColores.ts (colorTicket), en hex porque los charts no
// aceptan clases Tailwind. El gris de "cerrado" falla el piso de croma del
// validador a propósito (es el color "neutro/inactivo", no una categoría
// identitaria) - cada porción del donut lleva label directo, no depende del
// color para distinguirse.
const ORDEN_ESTADOS = ['abierto', 'en_proceso', 'esperando_cliente', 'resuelto', 'cerrado'] as const
const categoriasEstado = {
  abierto: { name: 'Abierto', color: '#dc2626' },
  en_proceso: { name: 'En proceso', color: '#1075b5' },
  esperando_cliente: { name: 'Esperando cliente', color: '#d97706' },
  resuelto: { name: 'Resuelto', color: '#16a34a' },
  cerrado: { name: 'Cerrado', color: '#57534e' },
}
const dataEstados = computed(() => {
  const conteo = new Map(ORDEN_ESTADOS.map((e) => [e, 0]))
  for (const t of todos.value) conteo.set(t.estado, (conteo.get(t.estado) ?? 0) + 1)
  return ORDEN_ESTADOS.map((e) => conteo.get(e) ?? 0)
})

const LABEL_PRIORIDAD: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente' }
const ORDEN_PRIORIDAD = ['baja', 'media', 'alta', 'urgente'] as const
const categoriasPrioridad = { cantidad: { name: 'Tickets', color: '#1075b5' } }
const dataPrioridad = computed(() => {
  const conteo = new Map(ORDEN_PRIORIDAD.map((p) => [p, 0]))
  for (const t of activos.value) conteo.set(t.prioridad, (conteo.get(t.prioridad) ?? 0) + 1)
  return ORDEN_PRIORIDAD.map((p) => ({ prioridad: p, cantidad: conteo.get(p) ?? 0 }))
})
const xFormatterPrioridad = (i: number) => LABEL_PRIORIDAD[dataPrioridad.value[i]?.prioridad] ?? ''

// Últimos 30 días: creados (created_at) vs cerrados (fecha_cierre), por día.
const categoriasTendencia = {
  creados: { name: 'Creados', color: '#1075b5' },
  cerrados: { name: 'Cerrados', color: '#16a34a' },
}
function aDiaKey(fecha: string) {
  return fecha.slice(0, 10)
}
const dataTendencia = computed(() => {
  const dias: { key: string; label: string; creados: number; cerrados: number }[] = []
  const hoy = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i)
    const key = aDiaKey(d.toISOString())
    dias.push({ key, label: d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }), creados: 0, cerrados: 0 })
  }
  const porDia = new Map(dias.map((d) => [d.key, d]))
  for (const t of todos.value) {
    const creado = porDia.get(aDiaKey(t.created_at))
    if (creado) creado.creados++
    if (t.fecha_cierre) {
      const cerrado = porDia.get(aDiaKey(t.fecha_cierre))
      if (cerrado) cerrado.cerrados++
    }
  }
  return dias
})
const xFormatterTendencia = (i: number) => dataTendencia.value[i]?.label ?? ''
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Dashboard — Servicio Técnico" />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <WidgetsKpiCard label="Total tickets" :valor="totalTickets" icono="🎫" />
        <WidgetsKpiCard label="Abiertos" :valor="ticketsAbiertos" icono="🔧" />
        <WidgetsKpiCard label="Resueltos" :valor="ticketsResueltos" icono="✅" />
        <WidgetsKpiCard label="Cerrados" :valor="ticketsCerrados" icono="📁" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          <p class="text-sm font-semibold text-gray-700 mb-3">Distribución por estado</p>
          <p v-if="!totalTickets" class="text-sm text-gray-400">Sin tickets todavía.</p>
          <DonutChart
            v-else
            :data="dataEstados"
            :categories="categoriasEstado"
            :radius="100"
            :height="280"
          />
        </div>

        <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          <p class="text-sm font-semibold text-gray-700 mb-3">Distribución por prioridad (activos)</p>
          <p v-if="!activos.length" class="text-sm text-gray-400">Sin tickets activos.</p>
          <BarChart
            v-else
            :data="dataPrioridad"
            :categories="categoriasPrioridad"
            :y-axis="['cantidad']"
            :height="280"
            :x-formatter="xFormatterPrioridad"
            :hide-legend="true"
          />
        </div>
      </div>

      <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
        <p class="text-sm font-semibold text-gray-700 mb-3">Tendencia — últimos 30 días</p>
        <LineChart
          :data="dataTendencia"
          :categories="categoriasTendencia"
          :height="280"
          :x-formatter="xFormatterTendencia"
          x-label="Día"
          y-label="Tickets"
        />
      </div>
    </template>
  </div>
</template>
