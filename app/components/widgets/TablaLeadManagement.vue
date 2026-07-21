<script setup lang="ts">
const { fetchLeads, fetchCerrados } = useLeads()
const cargando = ref(true)
const busqueda = ref('')
const leads = ref<Lead[]>([])

onMounted(async () => {
  const [activos, cerrados] = await Promise.all([fetchLeads(), fetchCerrados()])
  const porId = new Map(activos.map((l) => [l.id, l]))
  for (const l of cerrados) porId.set(l.id, l)
  leads.value = [...porId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))
  cargando.value = false
})

const filtrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return leads.value
  return leads.value.filter((l) => l.nombre.toLowerCase().includes(q))
})

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-4">
    <div class="flex items-center justify-between mb-3 gap-3">
      <p class="text-sm font-semibold text-ink">Lead management</p>
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por nombre..."
        class="text-sm border border-border rounded-lg px-3 py-1.5 w-48 sm:w-64"
      />
    </div>

    <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>
    <p v-else-if="!leads.length" class="text-sm text-ink-muted">Sin leads todavía.</p>
    <p v-else-if="!filtrados.length" class="text-sm text-ink-muted">Sin resultados para "{{ busqueda }}".</p>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-ink-muted uppercase border-b border-border">
            <th class="py-2 pr-3 font-medium">Nombre</th>
            <th class="py-2 pr-3 font-medium">Origen</th>
            <th class="py-2 pr-3 font-medium">Teléfono</th>
            <th class="py-2 pr-3 font-medium">Email</th>
            <th class="py-2 pr-3 font-medium">Estado</th>
            <th class="py-2 pr-3 font-medium">Fecha</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in filtrados" :key="l.id" class="border-b border-border last:border-0">
            <td class="py-2 pr-3 text-ink">{{ l.nombre }}</td>
            <td class="py-2 pr-3">
              <span class="text-xs font-medium rounded-full px-2 py-0.5" :class="colorCanal(l.origen ?? 'web').clases">
                {{ colorCanal(l.origen ?? 'web').label }}
              </span>
            </td>
            <td class="py-2 pr-3 text-ink-secondary">{{ l.telefono ?? '—' }}</td>
            <td class="py-2 pr-3 text-ink-secondary">{{ l.email ?? '—' }}</td>
            <td class="py-2 pr-3">
              <span class="text-xs font-medium rounded-full px-2 py-0.5" :class="colorLead(l.estado).clases">
                {{ colorLead(l.estado).label }}
              </span>
            </td>
            <td class="py-2 pr-3 text-ink-secondary whitespace-nowrap">{{ formatearFecha(l.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
