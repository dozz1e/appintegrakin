<script setup lang="ts">
const { fetchLeads, fetchCerrados } = useLeads()
const { fetchHistorial } = useHistorialEstados()
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
// Cambios de estado por lead (propios, ascendente) - se arma una sola vez en
// onMounted, no depende de diasSeleccionados.
const cambiosPorLead = ref<Map<string, HistorialEstadoRow[]>>(new Map())

// Reconstruye en qué estado estaba cada lead, día por día (no solo el día
// que se creó): arranca en 'nuevo' (default de la tabla) y va aplicando los
// cambios de historial_estados que ya ocurrieron a esa fecha. Si un lead
// se mantiene igual al día siguiente, se cuenta de nuevo en ese estado -
// por eso cada lead aporta una cuenta en TODOS los días en que ya existía,
// no solo en el de su creación.
const data = computed<Bucket[]>(() => {
  const dias: Bucket[] = []
  const hoy = new Date()
  for (let i = diasSeleccionados.value - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i, 23, 59, 59, 999)
    const key = aDiaKey(d.toISOString())
    const base = { key, label: d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) }
    dias.push(Object.assign(base, Object.fromEntries(ORDEN_ESTADOS.map((e) => [e, 0]))) as Bucket)
  }

  for (const lead of todos.value) {
    const cambios = cambiosPorLead.value.get(lead.id) ?? []
    const creado = new Date(lead.created_at).getTime()
    let estadoActual: string = 'nuevo'
    let idxCambio = 0

    for (const dia of dias) {
      const finDelDia = new Date(dia.key + 'T23:59:59.999').getTime()
      if (creado > finDelDia) continue // el lead todavía no existía ese día

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
  const [activos, cerrados, historial] = await Promise.all([fetchLeads(), fetchCerrados(), fetchHistorial('lead')])
  const porId = new Map(activos.map((l) => [l.id, l]))
  for (const l of cerrados) porId.set(l.id, l)
  todos.value = [...porId.values()]

  // historial_estados no filtra por dueño (RLS solo exige permiso leads.view),
  // así que se acota acá a los leads propios y se ordena ascendente para
  // poder aplicar los cambios en orden cronológico.
  const idsPropios = new Set(todos.value.map((l) => l.id))
  const mapa = new Map<string, HistorialEstadoRow[]>()
  for (const cambio of historial) {
    if (!idsPropios.has(cambio.entidad_id)) continue
    const lista = mapa.get(cambio.entidad_id) ?? []
    lista.push(cambio)
    mapa.set(cambio.entidad_id, lista)
  }
  for (const lista of mapa.values()) lista.sort((a, b) => a.created_at.localeCompare(b.created_at))
  cambiosPorLead.value = mapa

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
