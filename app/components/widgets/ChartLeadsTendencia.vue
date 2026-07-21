<script setup lang="ts">
const { fetchLeads, fetchCerrados } = useLeads()
const cargando = ref(true)

const ORDEN_ESTADOS = ['nuevo', 'contactado', 'cotizado', 'negociacion', 'ganado', 'perdido'] as const
const categorias = Object.fromEntries(
  ORDEN_ESTADOS.map((estado) => [estado, { name: colorLead(estado).label, color: colorLeadHex(estado) }])
)

function aDiaKey(fecha: string) {
  return fecha.slice(0, 10)
}

type Bucket = { key: string; label: string } & Record<(typeof ORDEN_ESTADOS)[number], number>

const opcionesDias = [7, 30, 90]
const diasSeleccionados = ref(30)
const todos = ref<Lead[]>([])

// Aproximación necesaria por el schema: no se guarda historial de estado, solo
// el actual. Cada lead se cuenta en el día que se creó, clasificado por su
// estado de HOY (no el que tenía ese día) - por eso "ganado"/"perdido" pueden
// verse en fechas donde en realidad el lead todavía estaba "nuevo".
const data = computed<Bucket[]>(() => {
  const dias: Bucket[] = []
  const hoy = new Date()
  for (let i = diasSeleccionados.value - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i)
    const key = aDiaKey(d.toISOString())
    const base = { key, label: d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) }
    dias.push(Object.assign(base, Object.fromEntries(ORDEN_ESTADOS.map((e) => [e, 0]))) as Bucket)
  }
  const porDia = new Map(dias.map((d) => [d.key, d]))
  for (const l of todos.value) {
    const bucket = porDia.get(aDiaKey(l.created_at))
    if (bucket) bucket[l.estado]++
  }
  return dias
})
const xFormatter = (i: number) => data.value[i]?.label ?? ''

// Dominio Y fijo en vez del auto-ajuste del chart: con pocos leads/día el
// máximo real puede ser 1, y el auto-domain grafica un eje "0 a 1" que se ve
// roto. Se redondea hacia arriba al siguiente múltiplo de 5, con piso de 5.
const yMax = computed(() => {
  let max = 0
  for (const dia of data.value) {
    for (const estado of ORDEN_ESTADOS) max = Math.max(max, dia[estado])
  }
  return Math.max(5, Math.ceil(max / 5) * 5)
})
const yDomain = computed<[number, number]>(() => [0, yMax.value])

onMounted(async () => {
  const [activos, cerrados] = await Promise.all([fetchLeads(), fetchCerrados()])
  const porId = new Map(activos.map((l) => [l.id, l]))
  for (const l of cerrados) porId.set(l.id, l)
  todos.value = [...porId.values()]
  cargando.value = false
})
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-4">
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm font-semibold text-ink">Leads captados</p>
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
      y-label="Leads"
    />
  </div>
</template>
