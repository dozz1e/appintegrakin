<script setup lang="ts">
const { fetchClientes } = useClientes()
const { fetchUsuariosPorRol } = useUsuarios()
const cargando = ref(true)

// Paleta fija cíclica - no hay forma de saber de antemano cuántos vendedores
// habrá, así que se recorre en módulo en vez de mapear 1 a 1 como con estados.
const PALETA = ['#1075b5', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#65a30d', '#db2777']

function aDiaKey(fecha: string) {
  return fecha.slice(0, 10)
}

type Bucket = { key: string; label: string } & Record<string, number>

const opcionesDias = [7, 30, 90]
const diasSeleccionados = ref(30)
const clientes = ref<Cliente[]>([])
const vendedores = ref<Usuario[]>([])

const categorias = computed(() =>
  Object.fromEntries(
    vendedores.value.map((v, i) => [v.id, { name: v.full_name ?? 'Sin nombre', color: PALETA[i % PALETA.length] }])
  )
)

const data = computed<Bucket[]>(() => {
  const dias: Bucket[] = []
  const hoy = new Date()
  for (let i = diasSeleccionados.value - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i)
    const key = aDiaKey(d.toISOString())
    const base = { key, label: d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) }
    dias.push(Object.assign(base, Object.fromEntries(vendedores.value.map((v) => [v.id, 0]))) as Bucket)
  }

  const porDia = new Map(dias.map((d) => [d.key, d]))
  for (const cliente of clientes.value) {
    if (!cliente.owner_id) continue
    const dia = porDia.get(aDiaKey(cliente.created_at))
    if (!dia || !(cliente.owner_id in dia)) continue
    ;(dia as any)[cliente.owner_id]++
  }
  return dias
})
const xFormatter = (i: number) => data.value[i]?.label ?? ''

// Mismo criterio de dominio Y dinámico que ChartLeadsTendencia: con pocos
// clientes/día el auto-domain de la lib grafica un eje roto.
const yMax = computed(() => {
  let max = 0
  for (const dia of data.value) {
    for (const v of vendedores.value) max = Math.max(max, dia[v.id] ?? 0)
  }
  return Math.max(5, Math.ceil(max / 5) * 5)
})
const yDomain = computed<[number, number]>(() => [0, yMax.value])

onMounted(async () => {
  const [listaClientes, listaVendedores] = await Promise.all([fetchClientes(), fetchUsuariosPorRol('ventas')])
  clientes.value = listaClientes
  vendedores.value = listaVendedores
  cargando.value = false
})
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-4">
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm font-semibold text-ink">Clientes captados por vendedor</p>
      <select
        v-model.number="diasSeleccionados"
        class="text-xs border border-border rounded-lg px-2 py-1 bg-surface text-ink-secondary"
      >
        <option v-for="d in opcionesDias" :key="d" :value="d">Últimos {{ d }} días</option>
      </select>
    </div>
    <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>
    <p v-else-if="!vendedores.length" class="text-sm text-ink-muted">Sin vendedores todavía.</p>
    <LineChart
      v-else
      :data="data"
      :categories="categorias"
      :height="400"
      :x-formatter="xFormatter"
      :y-domain="yDomain"
      :y-num-ticks="5"
      x-label="Día"
      y-label="Clientes"
    />
  </div>
</template>
