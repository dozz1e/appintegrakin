<script setup lang="ts">
// Card accionable: a diferencia de los charts de arriba (que solo informan),
// esta responde "¿a quién tengo que escribirle ahora?" - los leads activos
// (no cerrados) con más tiempo sin movimiento, los que más riesgo tienen de
// enfriarse.
const { fetchLeads } = useLeads()
const cargando = ref(true)
const leads = ref<Lead[]>([])

const LIMITE = 5

onMounted(async () => {
  leads.value = await fetchLeads()
  cargando.value = false
})

const diasSinMovimiento = (fecha: string) => Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)

const ranking = computed(() =>
  [...leads.value]
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    .slice(0, LIMITE)
    .map((l) => ({ ...l, dias: diasSinMovimiento(l.updated_at) }))
)
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-4">
    <p class="text-sm font-semibold text-ink mb-3">Leads que necesitan atención</p>
    <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>
    <p v-else-if="!ranking.length" class="text-sm text-ink-muted">Sin leads activos pendientes.</p>

    <ul v-else class="space-y-2">
      <li v-for="l in ranking" :key="l.id">
        <NuxtLink
          :to="`/leads/${l.id}`"
          class="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-bg transition-colors"
        >
          <span class="flex items-center gap-2 min-w-0">
            <span class="text-sm font-medium text-ink truncate">{{ l.nombre }}</span>
            <span class="text-xs px-1.5 py-0.5 rounded-full shrink-0" :class="colorLead(l.estado).clases">
              {{ colorLead(l.estado).label }}
            </span>
          </span>
          <span class="text-xs text-ink-muted shrink-0">
            {{ l.dias === 0 ? 'hoy' : `hace ${l.dias} día${l.dias === 1 ? '' : 's'}` }}
          </span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
