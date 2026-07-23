<script setup lang="ts">
// Card accionable para el líder: a quién del equipo ir a preguntar. Un
// vendedor "estancado" es el que tiene leads activos sin movimiento hace
// más de UMBRAL_DIAS - se rankean por el lead más viejo sin tocar.
const { fetchLeads } = useLeads()
const { fetchUsuariosPorRol } = useUsuarios()
const cargando = ref(true)
const leads = ref<Lead[]>([])
const vendedores = ref<Usuario[]>([])

const UMBRAL_DIAS = 3
const LIMITE = 5

const diasSinMovimiento = (fecha: string) => Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)

onMounted(async () => {
  const [listaLeads, listaVendedores] = await Promise.all([fetchLeads(), fetchUsuariosPorRol('ventas')])
  leads.value = listaLeads
  vendedores.value = listaVendedores
  cargando.value = false
})

const ranking = computed(() => {
  const nombrePorId = new Map(vendedores.value.map((v) => [v.id, v.full_name ?? 'Sin nombre']))
  const porVendedor = new Map<string, { estancados: number; maxDias: number }>()

  for (const l of leads.value) {
    if (!l.owner_id || !nombrePorId.has(l.owner_id)) continue
    const dias = diasSinMovimiento(l.updated_at)
    if (dias < UMBRAL_DIAS) continue
    const actual = porVendedor.get(l.owner_id) ?? { estancados: 0, maxDias: 0 }
    actual.estancados++
    actual.maxDias = Math.max(actual.maxDias, dias)
    porVendedor.set(l.owner_id, actual)
  }

  return [...porVendedor.entries()]
    .map(([id, v]) => ({ vendedor: nombrePorId.get(id) ?? 'Sin nombre', ...v }))
    .sort((a, b) => b.maxDias - a.maxDias)
    .slice(0, LIMITE)
})
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-4">
    <p class="text-sm font-semibold text-ink mb-3">Vendedores con leads estancados</p>
    <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>
    <p v-else-if="!ranking.length" class="text-sm text-ink-muted">Sin leads estancados, buen trabajo.</p>

    <ul v-else class="space-y-2">
      <li v-for="v in ranking" :key="v.vendedor" class="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
        <span class="text-sm font-medium text-ink truncate">{{ v.vendedor }}</span>
        <span class="text-xs text-ink-muted shrink-0">
          {{ v.estancados }} lead{{ v.estancados === 1 ? '' : 's' }} · más antiguo {{ v.maxDias }} días
        </span>
      </li>
    </ul>
  </div>
</template>
