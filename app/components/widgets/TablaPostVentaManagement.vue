<script setup lang="ts">
const { fetchTickets, fetchCerrados } = useTicketsPostVenta()
const cargando = ref(true)
const busqueda = ref('')
const tickets = ref<TicketPostVentaConNombres[]>([])

onMounted(async () => {
  const [activos, despachados] = await Promise.all([fetchTickets(), fetchCerrados()])
  const porId = new Map(activos.map((t) => [t.id, t]))
  for (const t of despachados) porId.set(t.id, t)
  tickets.value = [...porId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))
  cargando.value = false
})

const filtrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return tickets.value
  return tickets.value.filter((t) => t.n_guia.toLowerCase().includes(q) || t.cliente_nombre.toLowerCase().includes(q))
})

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
function estaVencido(t: TicketPostVentaConNombres) {
  return t.estado !== 'despachado' && !!t.fecha_tope && new Date(t.fecha_tope) < new Date()
}
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-4">
    <div class="flex items-center justify-between mb-3 gap-3">
      <p class="text-sm font-semibold text-ink">Post venta management</p>
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por guía o cliente..."
        class="text-sm border border-border rounded-lg px-3 py-1.5 w-48 sm:w-64"
      />
    </div>

    <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>
    <p v-else-if="!tickets.length" class="text-sm text-ink-muted">Sin tickets todavía.</p>
    <p v-else-if="!filtrados.length" class="text-sm text-ink-muted">Sin resultados para "{{ busqueda }}".</p>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-ink-muted uppercase border-b border-border">
            <th class="py-2 pr-3 font-medium">N° guía</th>
            <th class="py-2 pr-3 font-medium">Cliente</th>
            <th class="py-2 pr-3 font-medium">Producto</th>
            <th class="py-2 pr-3 font-medium">Estado</th>
            <th class="py-2 pr-3 font-medium">Ingreso</th>
            <th class="py-2 pr-3 font-medium">Tope</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in filtrados" :key="t.id" class="border-b border-border last:border-0">
            <td class="py-2 pr-3">
              <NuxtLink :to="`/post-venta/${t.id}`" class="text-ink font-medium hover:underline hover:text-primary">
                {{ t.n_guia }}
              </NuxtLink>
            </td>
            <td class="py-2 pr-3 text-ink-secondary">{{ t.cliente_nombre }}</td>
            <td class="py-2 pr-3 text-ink-secondary">{{ t.producto_nombre }}</td>
            <td class="py-2 pr-3">
              <span class="text-xs font-medium rounded-full px-2 py-0.5" :class="colorTicketPostVenta(t.estado).clases">
                {{ colorTicketPostVenta(t.estado).label }}
              </span>
            </td>
            <td class="py-2 pr-3 text-ink-secondary whitespace-nowrap">{{ t.fecha_ingreso ? formatearFecha(t.fecha_ingreso) : '—' }}</td>
            <td class="py-2 pr-3 whitespace-nowrap" :class="estaVencido(t) ? 'text-danger-text font-medium' : 'text-ink-secondary'">
              {{ t.fecha_tope ? formatearFecha(t.fecha_tope) : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
