<script setup lang="ts">
const { fetchTickets, fetchCerrados } = useTickets()
const cargando = ref(true)

// Últimos 30 días: creados (created_at) vs cerrados (fecha_cierre), por día.
const categorias = {
  creados: { name: 'Creados', color: '#1075b5' },
  cerrados: { name: 'Cerrados', color: '#16a34a' },
}
function aDiaKey(fecha: string) {
  return fecha.slice(0, 10)
}
const data = ref<{ key: string; label: string; creados: number; cerrados: number }[]>([])
const xFormatter = (i: number) => data.value[i]?.label ?? ''

onMounted(async () => {
  const [activos, cerrados] = await Promise.all([fetchTickets(), fetchCerrados()])
  const porId = new Map(activos.map((t) => [t.id, t]))
  for (const t of cerrados) porId.set(t.id, t)
  const todos = [...porId.values()]

  const dias: { key: string; label: string; creados: number; cerrados: number }[] = []
  const hoy = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i)
    const key = aDiaKey(d.toISOString())
    dias.push({ key, label: d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }), creados: 0, cerrados: 0 })
  }
  const porDia = new Map(dias.map((d) => [d.key, d]))
  for (const t of todos) {
    const creado = porDia.get(aDiaKey(t.created_at))
    if (creado) creado.creados++
    if (t.fecha_cierre) {
      const cerrado = porDia.get(aDiaKey(t.fecha_cierre))
      if (cerrado) cerrado.cerrados++
    }
  }
  data.value = dias
  cargando.value = false
})
</script>

<template>
  <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
    <p class="text-sm font-semibold text-gray-700 mb-3">Tendencia 30 días (Servicio técnico)</p>
    <p v-if="cargando" class="text-gray-400 text-sm">Cargando...</p>
    <LineChart
      v-else
      :data="data"
      :categories="categorias"
      :height="280"
      :x-formatter="xFormatter"
      x-label="Día"
      y-label="Tickets"
    />
  </div>
</template>
