<script setup lang="ts">
// Reemplaza el ranking de píldoras (que ordenaba por conteo actual, sin
// noción de secuencia) por un embudo real: cuántos leads ALCANZARON cada
// etapa del pipeline en algún momento, no cuántos están ahí ahora mismo.
// Usa historial_estados (mismo dato que ChartLeadsTendencia) para reconstruir
// la etapa más avanzada que tocó cada lead - así el embudo siempre baja o
// se mantiene, nunca "sube" por un lead que retrocedió de estado.
const { fetchLeads, fetchCerrados } = useLeads()
const { fetchHistorial } = useHistorialEstados()
const cargando = ref(true)

const ETAPAS = ['nuevo', 'contactado', 'cotizado', 'negociacion', 'ganado'] as const

const conteos = ref<number[]>(ETAPAS.map(() => 0))
const totalLeads = ref(0)
const perdidos = ref(0)

onMounted(async () => {
  const [activos, cerrados, historial] = await Promise.all([fetchLeads(), fetchCerrados(), fetchHistorial('lead')])
  const porId = new Map(activos.map((l) => [l.id, l]))
  for (const l of cerrados) porId.set(l.id, l)
  const todos = [...porId.values()]
  totalLeads.value = todos.length

  const cambiosPorLead = new Map<string, typeof historial>()
  for (const cambio of historial) {
    const lista = cambiosPorLead.get(cambio.entidad_id) ?? []
    lista.push(cambio)
    cambiosPorLead.set(cambio.entidad_id, lista)
  }
  for (const lista of cambiosPorLead.values()) lista.sort((a, b) => a.created_at.localeCompare(b.created_at))

  const nuevos = ETAPAS.map(() => 0)
  for (const lead of todos) {
    let maxIdx = 0
    for (const cambio of cambiosPorLead.get(lead.id) ?? []) {
      const idx = ETAPAS.indexOf(cambio.estado_nuevo as (typeof ETAPAS)[number])
      if (idx > maxIdx) maxIdx = idx
    }
    for (let i = 0; i <= maxIdx; i++) nuevos[i]!++
    if (lead.estado === 'perdido') perdidos.value++
  }
  conteos.value = nuevos

  cargando.value = false
})

const filas = computed(() =>
  ETAPAS.map((estado, i) => ({
    estado,
    label: colorLead(estado).label,
    clases: colorLead(estado).clases,
    total: conteos.value[i] ?? 0,
    pctTotal: totalLeads.value ? Math.round(((conteos.value[i] ?? 0) / totalLeads.value) * 100) : 0,
    pctPrevio:
      i === 0 || !conteos.value[i - 1]
        ? null
        : Math.round(((conteos.value[i] ?? 0) / (conteos.value[i - 1] ?? 1)) * 100),
  }))
)
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-4">
    <p class="text-sm font-semibold text-ink mb-3">Embudo de conversión</p>
    <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>
    <p v-else-if="!totalLeads" class="text-sm text-ink-muted">Sin leads todavía.</p>

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
      <p v-if="perdidos" class="text-sm text-ink-muted pt-1">{{ perdidos }} lead{{ perdidos === 1 ? '' : 's' }} perdido{{ perdidos === 1 ? '' : 's' }} en el camino.</p>
    </div>
  </div>
</template>
