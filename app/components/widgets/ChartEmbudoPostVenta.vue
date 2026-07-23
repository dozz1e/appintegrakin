<script setup lang="ts">
// Mismo criterio que ChartEmbudoLeads: reemplaza el ranking de píldoras
// (ordenado por conteo, sin noción de secuencia) por un embudo real -
// cuántos tickets ALCANZARON cada paso del pipeline técnico en algún
// momento, ordenado por la secuencia real del proceso. 'desconocido' es un
// estado de error/fallback, no un paso del pipeline - se cuenta aparte.
const { fetchTickets, fetchCerrados } = useTicketsPostVenta()
const { fetchHistorial } = useHistorialEstados()
const cargando = ref(true)

const ETAPAS = ['pendiente_ingreso', 'ingreso_equipo', 'probando', 'espera_repuesto', 'listo_despacho', 'despachado'] as const

const conteos = ref<number[]>(ETAPAS.map(() => 0))
const totalTickets = ref(0)
const desconocidos = ref(0)

onMounted(async () => {
  const [activos, despachados, historial] = await Promise.all([fetchTickets(), fetchCerrados(), fetchHistorial('ticket_post_venta')])
  const porId = new Map(activos.map((t) => [t.id, t]))
  for (const t of despachados) porId.set(t.id, t)
  const todos = [...porId.values()]
  totalTickets.value = todos.length

  const cambiosPorTicket = new Map<string, typeof historial>()
  for (const cambio of historial) {
    const lista = cambiosPorTicket.get(cambio.entidad_id) ?? []
    lista.push(cambio)
    cambiosPorTicket.set(cambio.entidad_id, lista)
  }
  for (const lista of cambiosPorTicket.values()) lista.sort((a, b) => a.created_at.localeCompare(b.created_at))

  const nuevos = ETAPAS.map(() => 0)
  for (const ticket of todos) {
    let maxIdx = 0
    for (const cambio of cambiosPorTicket.get(ticket.id) ?? []) {
      const idx = ETAPAS.indexOf(cambio.estado_nuevo as (typeof ETAPAS)[number])
      if (idx > maxIdx) maxIdx = idx
    }
    for (let i = 0; i <= maxIdx; i++) nuevos[i]!++
    if (ticket.estado === 'desconocido') desconocidos.value++
  }
  conteos.value = nuevos

  cargando.value = false
})

const filas = computed(() =>
  ETAPAS.map((estado, i) => ({
    estado,
    label: colorTicketPostVenta(estado).label,
    clases: colorTicketPostVenta(estado).clases,
    total: conteos.value[i] ?? 0,
    pctTotal: totalTickets.value ? Math.round(((conteos.value[i] ?? 0) / totalTickets.value) * 100) : 0,
    pctPrevio:
      i === 0 || !conteos.value[i - 1]
        ? null
        : Math.round(((conteos.value[i] ?? 0) / (conteos.value[i - 1] ?? 1)) * 100),
  }))
)
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-4">
    <p class="text-sm font-semibold text-ink mb-3">Embudo del pipeline técnico</p>
    <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>
    <p v-else-if="!totalTickets" class="text-sm text-ink-muted">Sin tickets todavía.</p>

    <div v-else class="space-y-2">
      <div v-for="f in filas" :key="f.estado">
        <div class="flex items-center justify-between text-sm text-ink-secondary mb-1">
          <span class="font-medium">{{ f.label }}</span>
          <span>{{ f.total }} ({{ f.pctTotal }}%)<template v-if="f.pctPrevio !== null"> · {{ f.pctPrevio }}% del anterior</template></span>
        </div>
        <div class="h-4 rounded-lg bg-neutral-bg overflow-hidden">
          <div class="h-full rounded-lg" :class="f.clases" :style="{ width: `${f.pctTotal}%` }" />
        </div>
      </div>
      <p v-if="desconocidos" class="text-sm text-ink-muted pt-1">{{ desconocidos }} ticket{{ desconocidos === 1 ? '' : 's' }} en estado desconocido.</p>
    </div>
  </div>
</template>
