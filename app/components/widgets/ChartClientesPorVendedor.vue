<script setup lang="ts">
// Barras hechas a mano en vez de BarChart (vue-chrts) - esa lib solo colorea
// por serie, no por barra individual, y acá cada vendedora necesita su
// propio color fijo (ver utils/ordenVendedores.ts) consistente con
// ChartPerformanceVendedores.
const { fetchClientes } = useClientes()
const { fetchUsuariosPorRol } = useUsuarios()
const cargando = ref(true)

const opcionesDias = [7, 30, 90]
const diasSeleccionados = ref(30)
const clientes = ref<Cliente[]>([])
const vendedores = ref<Usuario[]>([])

const ranking = computed(() => {
  const desde = Date.now() - diasSeleccionados.value * 86400000
  const conteo = new Map(vendedores.value.map((v) => [v.id, 0]))
  for (const c of clientes.value) {
    if (!c.owner_id || !conteo.has(c.owner_id)) continue
    if (new Date(c.created_at).getTime() < desde) continue
    conteo.set(c.owner_id, (conteo.get(c.owner_id) ?? 0) + 1)
  }
  return vendedores.value
    .map((v) => ({ vendedor: v.full_name ?? 'Sin nombre', clientes: conteo.get(v.id) ?? 0 }))
    .sort((a, b) => indiceOrdenVendedor(a.vendedor) - indiceOrdenVendedor(b.vendedor))
})
const maxValor = computed(() => Math.max(...ranking.value.map((r) => r.clientes), 1))

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
    <p v-else-if="!ranking.length" class="text-sm text-ink-muted">Sin vendedores todavía.</p>

    <div v-else class="space-y-2">
      <div v-for="r in ranking" :key="r.vendedor">
        <div class="flex items-center justify-between text-sm text-ink-secondary mb-1">
          <span class="font-medium">{{ r.vendedor }}</span>
          <span>{{ r.clientes }}</span>
        </div>
        <div class="h-4 rounded-lg bg-neutral-bg overflow-hidden">
          <div
            class="h-full rounded-lg"
            :style="{ width: `${(r.clientes / maxValor) * 100}%`, backgroundColor: colorVendedor(r.vendedor) }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
