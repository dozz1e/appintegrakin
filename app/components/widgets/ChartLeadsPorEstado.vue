<script setup lang="ts">
// Reemplaza al típico "top performers" de un dashboard de equipo: acá no
// aplica (el vendedor ve su propio dashboard, no el ranking de otros) - en
// su lugar, mismo lenguaje visual (píldora de color + conteo) pero para la
// distribución de sus propios leads por estado del pipeline.
const { fetchLeads, fetchCerrados } = useLeads()
const cargando = ref(true)

const ORDEN_ESTADOS = ['nuevo', 'contactado', 'cotizado', 'negociacion', 'ganado', 'perdido'] as const
const ICONOS: Record<string, string> = {
  nuevo: '🆕',
  contactado: '📞',
  cotizado: '💬',
  negociacion: '🤝',
  ganado: '✅',
  perdido: '❌',
}

const ranking = ref<{ estado: string; label: string; clases: string; total: number }[]>([])
const total = ref(0)

onMounted(async () => {
  const [activos, cerrados] = await Promise.all([fetchLeads(), fetchCerrados()])
  const porId = new Map(activos.map((l) => [l.id, l]))
  for (const l of cerrados) porId.set(l.id, l)
  const todos = [...porId.values()]
  total.value = todos.length

  const conteo = new Map(ORDEN_ESTADOS.map((e) => [e, 0]))
  for (const l of todos) conteo.set(l.estado, (conteo.get(l.estado) ?? 0) + 1)

  ranking.value = ORDEN_ESTADOS.map((estado) => ({
    estado,
    label: colorLead(estado).label,
    clases: colorLead(estado).clases,
    total: conteo.get(estado) ?? 0,
  })).sort((a, b) => b.total - a.total)

  cargando.value = false
})
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-3">
    <p class="text-xs font-semibold text-ink mb-2">Leads y sus estados</p>
    <p v-if="cargando" class="text-ink-muted text-xs">Cargando...</p>
    <p v-else-if="!total" class="text-xs text-ink-muted">Sin leads todavía.</p>

    <div v-else class="space-y-1.5">
      <div v-for="e in ranking" :key="e.estado" class="flex items-center gap-2">
        <div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0" :class="e.clases">
          {{ ICONOS[e.estado] }}
        </div>
        <div class="flex-1 flex items-center justify-between rounded-lg px-2 py-1 text-xs font-medium" :class="e.clases">
          <span>{{ e.label }}</span>
          <span>{{ e.total }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
