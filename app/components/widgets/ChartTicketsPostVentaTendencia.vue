<script setup lang="ts">
const { fetchTickets, fetchCerrados } = useTicketsPostVenta()
const { fetchHistorial } = useHistorialEstados()
const cargando = ref(true)

const ORDEN_ESTADOS = [
  'pendiente_ingreso', 'ingreso_equipo', 'probando', 'espera_repuesto', 'listo_despacho', 'despachado', 'desconocido',
] as const
const categorias = Object.fromEntries(
  ORDEN_ESTADOS.map((estado) => [estado, { name: colorTicketPostVenta(estado).label, color: colorTicketPostVentaHex(estado) }])
)

function aDiaKey(fecha: string) {
  return fecha.slice(0, 10)
}

type Bucket = { key: string; label: string } & Record<(typeof ORDEN_ESTADOS)[number], number>

const opcionesDias = [7, 30, 90]
const diasSeleccionados = ref(30)
const todos = ref<TicketPostVentaConNombres[]>([])
const cambiosPorTicket = ref<Map<string, HistorialEstadoRow[]>>(new Map())

// Mismo patrón que ChartLeadsTendencia: reconstruye en qué estado estaba
// cada ticket día por día usando historial_estados, arrancando en
// 'pendiente_ingreso' (default de la tabla).
const data = computed<Bucket[]>(() => {
  const dias: Bucket[] = []
  const hoy = new Date()
  for (let i = diasSeleccionados.value - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i, 23, 59, 59, 999)
    const key = aDiaKey(d.toISOString())
    const base = { key, label: d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) }
    dias.push(Object.assign(base, Object.fromEntries(ORDEN_ESTADOS.map((e) => [e, 0]))) as Bucket)
  }

  for (const ticket of todos.value) {
    const cambios = cambiosPorTicket.value.get(ticket.id) ?? []
    const creado = new Date(ticket.created_at).getTime()
    let estadoActual: string = 'pendiente_ingreso'
    let idxCambio = 0

    for (const dia of dias) {
      const finDelDia = new Date(dia.key + 'T23:59:59.999').getTime()
      if (creado > finDelDia) continue

      while (idxCambio < cambios.length && new Date(cambios[idxCambio].created_at).getTime() <= finDelDia) {
        estadoActual = cambios[idxCambio].estado_nuevo
        idxCambio++
      }
      if (estadoActual in dia) (dia as any)[estadoActual]++
    }
  }
  return dias
})
const xFormatter = (i: number) => data.value[i]?.label ?? ''

const yMax = computed(() => {
  let max = 0
  for (const dia of data.value) {
    for (const estado of ORDEN_ESTADOS) max = Math.max(max, dia[estado])
  }
  return Math.max(5, Math.ceil(max / 5) * 5)
})
const yDomain = computed<[number, number]>(() => [0, yMax.value])

onMounted(async () => {
  const [activos, despachados, historial] = await Promise.all([
    fetchTickets(),
    fetchCerrados(),
    fetchHistorial('ticket_post_venta'),
  ])
  const porId = new Map(activos.map((t) => [t.id, t]))
  for (const t of despachados) porId.set(t.id, t)
  todos.value = [...porId.values()]

  const idsPropios = new Set(todos.value.map((t) => t.id))
  const mapa = new Map<string, HistorialEstadoRow[]>()
  for (const cambio of historial) {
    if (!idsPropios.has(cambio.entidad_id)) continue
    const lista = mapa.get(cambio.entidad_id) ?? []
    lista.push(cambio)
    mapa.set(cambio.entidad_id, lista)
  }
  for (const lista of mapa.values()) lista.sort((a, b) => a.created_at.localeCompare(b.created_at))
  cambiosPorTicket.value = mapa

  cargando.value = false
})
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-4">
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm font-semibold text-ink">Tendencia post venta</p>
      <select
        v-model.number="diasSeleccionados"
        class="text-xs border border-border rounded-lg px-2 py-1 bg-surface text-ink-secondary"
      >
        <option v-for="d in opcionesDias" :key="d" :value="d">Últimos {{ d }} días</option>
      </select>
    </div>
    <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>
    <LineChart
      v-else
      :data="data"
      :categories="categorias"
      :height="400"
      :x-formatter="xFormatter"
      :y-domain="yDomain"
      :y-num-ticks="5"
      x-label="Día"
      y-label="Tickets"
    />
  </div>
</template>
