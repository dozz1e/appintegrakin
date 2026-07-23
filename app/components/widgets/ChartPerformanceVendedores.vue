<script setup lang="ts">
// Barras hechas a mano en vez de BarChart (vue-chrts) - esa lib solo colorea
// por serie, no por barra individual, y acá cada vendedora necesita su
// propio color fijo (ver utils/ordenVendedores.ts) consistente con
// ChartClientesPorVendedor.
const { fetchPerformance } = useReportes()
const { can } = usePermissions()

const opcionesDias = [7, 30, 90]
const diasSeleccionados = ref(30)
const performance = ref<PerformanceVendedor[]>([])
const cargando = ref(true)

async function cargar() {
  if (!can('reportes', 'view_all')) {
    cargando.value = false
    return
  }
  cargando.value = true
  performance.value = await fetchPerformance(diasSeleccionados.value)
  cargando.value = false
}

onMounted(cargar)
watch(diasSeleccionados, cargar)

const ranking = computed(() =>
  performance.value
    .map((p) => ({ vendedor: p.full_name ?? 'Sin nombre', leadsGanados: p.leads_ganados }))
    .sort((a, b) => indiceOrdenVendedor(a.vendedor) - indiceOrdenVendedor(b.vendedor))
)
const maxValor = computed(() => Math.max(...ranking.value.map((r) => r.leadsGanados), 1))
</script>

<template>
  <div v-if="can('reportes', 'view_all')" class="bg-surface border border-border rounded-2xl shadow-sm p-4">
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm font-semibold text-ink">Performance por vendedor</p>
      <select
        v-model.number="diasSeleccionados"
        class="text-xs border border-border rounded-lg px-2 py-1 bg-surface text-ink-secondary"
      >
        <option v-for="d in opcionesDias" :key="d" :value="d">Últimos {{ d }} días</option>
      </select>
    </div>
    <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>
    <p v-else-if="!ranking.length" class="text-sm text-ink-muted">Sin datos todavía.</p>

    <div v-else class="space-y-2">
      <div v-for="r in ranking" :key="r.vendedor">
        <div class="flex items-center justify-between text-sm text-ink-secondary mb-1">
          <span class="font-medium">{{ r.vendedor }}</span>
          <span>{{ r.leadsGanados }}</span>
        </div>
        <div class="h-4 rounded-lg bg-neutral-bg overflow-hidden">
          <div
            class="h-full rounded-lg"
            :style="{ width: `${(r.leadsGanados / maxValor) * 100}%`, backgroundColor: colorVendedor(r.vendedor) }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
