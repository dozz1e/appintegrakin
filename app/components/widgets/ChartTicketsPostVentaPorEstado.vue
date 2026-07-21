<script setup lang="ts">
const { fetchTickets, fetchCerrados } = useTicketsPostVenta()
const cargando = ref(true)

const ORDEN_ESTADOS = [
  'pendiente_ingreso', 'ingreso_equipo', 'probando', 'espera_repuesto', 'listo_despacho', 'despachado', 'desconocido',
] as const
const ICONOS: Record<string, string> = {
  pendiente_ingreso: '📥',
  ingreso_equipo: '📦',
  probando: '🔬',
  espera_repuesto: '⏳',
  listo_despacho: '✅',
  despachado: '🚚',
  desconocido: '❓',
}

const ranking = ref<{ estado: string; label: string; clases: string; total: number }[]>([])
const total = ref(0)

onMounted(async () => {
  const [activos, despachados] = await Promise.all([fetchTickets(), fetchCerrados()])
  const porId = new Map(activos.map((t) => [t.id, t]))
  for (const t of despachados) porId.set(t.id, t)
  const todos = [...porId.values()]
  total.value = todos.length

  const conteo = new Map(ORDEN_ESTADOS.map((e) => [e, 0]))
  for (const t of todos) conteo.set(t.estado, (conteo.get(t.estado) ?? 0) + 1)

  ranking.value = ORDEN_ESTADOS.map((estado) => ({
    estado,
    label: colorTicketPostVenta(estado).label,
    clases: colorTicketPostVenta(estado).clases,
    total: conteo.get(estado) ?? 0,
  })).sort((a, b) => b.total - a.total)

  cargando.value = false
})
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-3">
    <p class="text-sm font-semibold text-ink mb-2">Tickets y sus estados</p>
    <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>
    <p v-else-if="!total" class="text-sm text-ink-muted">Sin tickets todavía.</p>

    <div v-else class="space-y-1.5">
      <div v-for="e in ranking" :key="e.estado" class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0" :class="e.clases">
          {{ ICONOS[e.estado] }}
        </div>
        <div class="flex-1 flex items-center justify-between rounded-lg px-2 py-1 text-sm font-medium" :class="e.clases">
          <span>{{ e.label }}</span>
          <span>{{ e.total }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
