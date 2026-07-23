<script setup lang="ts">
// Reemplaza el LineChart de 7 series (una por estado del pipeline técnico,
// el más denso de los tres dashboards) por 2 series: cuántos tickets
// ENTRARON vs cuántos se DESPACHARON cada día. La pregunta real de un
// dashboard operativo - ¿sacamos tickets al mismo ritmo que entran? - no el
// detalle de cada paso intermedio (eso ya lo cubre el embudo aparte).
const { fetchTickets, fetchCerrados } = useTicketsPostVenta()
const cargando = ref(true)

function aDiaKey(fecha: string) {
  return fecha.slice(0, 10)
}

type Bucket = { key: string; label: string; ingresos: number; despachos: number }

const opcionesDias = [7, 30, 90]
const diasSeleccionados = ref(30)
const activos = ref<TicketPostVentaConNombres[]>([])
const despachados = ref<TicketPostVentaConNombres[]>([])

const data = computed<Bucket[]>(() => {
  const dias: Bucket[] = []
  const hoy = new Date()
  for (let i = diasSeleccionados.value - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i)
    const key = aDiaKey(d.toISOString())
    dias.push({ key, label: d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }), ingresos: 0, despachos: 0 })
  }

  const porDia = new Map(dias.map((d) => [d.key, d]))
  for (const t of [...activos.value, ...despachados.value]) {
    const dia = porDia.get(aDiaKey(t.created_at))
    if (dia) dia.ingresos++
  }
  for (const t of despachados.value) {
    if (!t.fecha_cierre) continue
    const dia = porDia.get(aDiaKey(t.fecha_cierre))
    if (dia) dia.despachos++
  }
  return dias
})
const xFormatter = (i: number) => data.value[i]?.label ?? ''
const categorias = {
  ingresos: { name: 'Ingresos', color: '#1075b5' },
  despachos: { name: 'Despachos', color: '#16a34a' },
}

const yMax = computed(() => {
  let max = 0
  for (const dia of data.value) max = Math.max(max, dia.ingresos, dia.despachos)
  return Math.max(5, Math.ceil(max / 5) * 5)
})
const yDomain = computed<[number, number]>(() => [0, yMax.value])

onMounted(async () => {
  const [listaActivos, listaDespachados] = await Promise.all([fetchTickets(), fetchCerrados()])
  activos.value = listaActivos
  despachados.value = listaDespachados
  cargando.value = false
})
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-4">
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm font-semibold text-ink">Ingresos vs. despachos</p>
      <select
        v-model.number="diasSeleccionados"
        class="text-xs border border-border rounded-lg px-2 py-1 bg-surface text-ink-secondary"
      >
        <option v-for="d in opcionesDias" :key="d" :value="d">Últimos {{ d }} días</option>
      </select>
    </div>
    <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>
    <BarChart
      v-else
      :data="data"
      :categories="categorias"
      :y-axis="['ingresos', 'despachos']"
      :height="320"
      :x-formatter="xFormatter"
      :y-domain="yDomain"
      :y-num-ticks="5"
      x-label="Día"
      y-label="Tickets"
    />
  </div>
</template>
