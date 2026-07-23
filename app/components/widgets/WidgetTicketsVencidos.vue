<script setup lang="ts">
// Card accionable: el KPI "Vencidos" ya existe pero solo da el número - acá
// la lista concreta para saber a cuál ticket entrarle primero. Mismo
// criterio de "vencido" que KpiTicketsPostVentaVencidos: fecha_tope pasada
// en un ticket activo.
const { fetchTickets } = useTicketsPostVenta()
const cargando = ref(true)
const tickets = ref<TicketPostVentaConNombres[]>([])

const LIMITE = 5

onMounted(async () => {
  tickets.value = await fetchTickets()
  cargando.value = false
})

const diasVencido = (fecha: string) => Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)

const ranking = computed(() =>
  tickets.value
    .filter((t) => t.fecha_tope && new Date(t.fecha_tope) < new Date())
    .sort((a, b) => a.fecha_tope!.localeCompare(b.fecha_tope!))
    .slice(0, LIMITE)
    .map((t) => ({ ...t, dias: diasVencido(t.fecha_tope!) }))
)
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-4">
    <p class="text-sm font-semibold text-ink mb-3">Tickets vencidos</p>
    <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>
    <p v-else-if="!ranking.length" class="text-sm text-ink-muted">Sin tickets vencidos.</p>

    <ul v-else class="space-y-2">
      <li v-for="t in ranking" :key="t.id">
        <NuxtLink
          :to="`/post-venta/${t.id}`"
          class="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-bg transition-colors"
        >
          <span class="flex items-center gap-2 min-w-0">
            <span class="text-sm font-medium text-ink truncate">{{ t.n_guia }}</span>
            <span class="text-xs text-ink-muted truncate">{{ t.cliente_nombre }}</span>
          </span>
          <span class="text-xs text-danger-text shrink-0">
            vencido hace {{ t.dias }} día{{ t.dias === 1 ? '' : 's' }}
          </span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
