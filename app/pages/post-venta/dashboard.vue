<!-- app/pages/post-venta/dashboard.vue -->
<script setup lang="ts">
import type { TicketPostVentaConNombres } from '~/composables/useTicketsPostVenta'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets_post_venta', actions: ['view'] },
})

const { fetchTickets, fetchCerrados } = useTicketsPostVenta()

const activos = ref<TicketPostVentaConNombres[]>([])
const todos = ref<TicketPostVentaConNombres[]>([])
const cargando = ref(true)

onMounted(async () => {
  const [act, despachados] = await Promise.all([fetchTickets(), fetchCerrados()])
  activos.value = act
  // Igual criterio que el dashboard de servicio técnico: fetchCerrados no
  // filtra archivado (historial completo de despachados), fetchTickets sí
  // (solo activos) - se unen y deduplican por id.
  const porId = new Map(act.map((t) => [t.id, t]))
  for (const t of despachados) porId.set(t.id, t)
  todos.value = [...porId.values()]
  cargando.value = false
})

const totalTickets = computed(() => todos.value.length)
const ticketsAbiertos = computed(() => activos.value.length)
const ticketsDespachados = computed(() => todos.value.filter((t) => t.estado === 'despachado').length)
const ticketsVencidos = computed(
  () => activos.value.filter((t) => t.fecha_tope && new Date(t.fecha_tope) < new Date()).length
)

// Colores de estado validados (accesibilidad CVD) - mismo criterio semántico
// que app/utils/estadoColores.ts (colorTicketPostVenta). pendiente_ingreso y
// despachado comparten el mismo gris ahí también (ambos "neutro/inactivo");
// cada porción del donut lleva label directo, no depende del color para
// distinguirse.
const ORDEN_ESTADOS = [
  'pendiente_ingreso', 'ingreso_equipo', 'probando', 'espera_repuesto', 'listo_despacho', 'despachado', 'desconocido',
] as const
const categoriasEstado = {
  pendiente_ingreso: { name: 'Pendiente de ingreso', color: '#57534e' },
  ingreso_equipo: { name: 'Ingreso de equipo', color: '#1075b5' },
  probando: { name: 'Probando', color: '#7c3aed' },
  espera_repuesto: { name: 'Espera de repuesto', color: '#d97706' },
  listo_despacho: { name: 'Listo para despacho', color: '#16a34a' },
  despachado: { name: 'Despachado', color: '#57534e' },
  desconocido: { name: 'Desconocido', color: '#dc2626' },
}
const dataEstados = computed(() => {
  const conteo = new Map(ORDEN_ESTADOS.map((e) => [e, 0]))
  for (const t of todos.value) conteo.set(t.estado, (conteo.get(t.estado) ?? 0) + 1)
  return ORDEN_ESTADOS.map((e) => conteo.get(e) ?? 0)
})

// Vencidos vs a tiempo, solo entre los activos (los despachados ya no
// "vencen"). Rojo/verde se evita a propósito (peor caso de daltonismo
// rojo-verde) - se usa rojo vs azul primario, validado.
const categoriasVencidos = {
  vencido: { name: 'Vencido', color: '#dc2626' },
  a_tiempo: { name: 'A tiempo', color: '#1075b5' },
}
const dataVencidos = computed(() => {
  const ahora = new Date()
  let vencido = 0
  let aTiempo = 0
  for (const t of activos.value) {
    if (t.fecha_tope && new Date(t.fecha_tope) < ahora) vencido++
    else aTiempo++
  }
  return [vencido, aTiempo]
})

// Últimos 30 días: ingresados (fecha_ingreso) vs despachados (fecha_despacho), por día.
const categoriasTendencia = {
  ingresados: { name: 'Ingresados', color: '#1075b5' },
  despachados: { name: 'Despachados', color: '#16a34a' },
}
function aDiaKey(fecha: string) {
  return fecha.slice(0, 10)
}
const dataTendencia = computed(() => {
  const dias: { key: string; label: string; ingresados: number; despachados: number }[] = []
  const hoy = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i)
    const key = aDiaKey(d.toISOString())
    dias.push({ key, label: d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }), ingresados: 0, despachados: 0 })
  }
  const porDia = new Map(dias.map((d) => [d.key, d]))
  for (const t of todos.value) {
    const ingreso = porDia.get(aDiaKey(t.fecha_ingreso))
    if (ingreso) ingreso.ingresados++
    if (t.fecha_despacho) {
      const despacho = porDia.get(aDiaKey(t.fecha_despacho))
      if (despacho) despacho.despachados++
    }
  }
  return dias
})
const xFormatterTendencia = (i: number) => dataTendencia.value[i]?.label ?? ''
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Dashboard — Post Venta" />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <WidgetsKpiCard label="Total tickets" :valor="totalTickets" icono="📦" />
        <WidgetsKpiCard label="Abiertos" :valor="ticketsAbiertos" icono="🛠️" />
        <WidgetsKpiCard label="Despachados" :valor="ticketsDespachados" icono="🚚" />
        <WidgetsKpiCard label="Vencidos" :valor="ticketsVencidos" icono="⏰" />
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
          <p class="text-sm font-semibold text-gray-700 mb-3">Vencidos vs a tiempo (activos)</p>
          <p v-if="!activos.length" class="text-sm text-gray-400">Sin tickets activos.</p>
          <DonutChart
            v-else
            :data="dataVencidos"
            :categories="categoriasVencidos"
            :radius="100"
            :height="280"
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
