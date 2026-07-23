<script setup lang="ts">
// Reemplaza al LineChart de 6 series (una por estado) que era ilegible con
// pocos leads/día. Acá una sola serie: cuántos leads se crearon cada día,
// sin desglose por estado (eso ya lo cubre el embudo de conversión aparte).
const { fetchLeads, fetchCerrados } = useLeads()
const cargando = ref(true)

function aDiaKey(fecha: string) {
  return fecha.slice(0, 10)
}

type Bucket = { key: string; label: string; total: number }

const opcionesDias = [7, 30, 90]
const diasSeleccionados = ref(30)
const todos = ref<Lead[]>([])

const data = computed<Bucket[]>(() => {
  const dias: Bucket[] = []
  const hoy = new Date()
  for (let i = diasSeleccionados.value - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i)
    const key = aDiaKey(d.toISOString())
    dias.push({ key, label: d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }), total: 0 })
  }

  const porDia = new Map(dias.map((d) => [d.key, d]))
  for (const lead of todos.value) {
    const dia = porDia.get(aDiaKey(lead.created_at))
    if (dia) dia.total++
  }
  return dias
})
const xFormatter = (i: number) => data.value[i]?.label ?? ''
const categorias = { total: { name: 'Leads captados', color: '#1075b5' } }

const yMax = computed(() => Math.max(5, Math.ceil(Math.max(...data.value.map((d) => d.total), 0) / 5) * 5))
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
    <BarChart
      v-else
      :data="data"
      :categories="categorias"
      :y-axis="['total']"
      :height="320"
      :x-formatter="xFormatter"
      :y-domain="yDomain"
      :y-num-ticks="5"
      x-label="Día"
      y-label="Leads"
      :hide-legend="true"
    />
  </div>
</template>
