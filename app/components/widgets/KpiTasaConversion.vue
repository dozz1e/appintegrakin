<script setup lang="ts">
const { fetchCerrados } = useLeads()
const tasa = ref('0%')
const delta = ref<number | null>(null)
const cargando = ref(true)

// Delta en puntos porcentuales (no %): compara la tasa de conversión de los
// últimos 30 días contra la de los 30 anteriores, ambas medidas por
// fecha_cierre. Distinto de calcularDeltaPct (esa mide crecimiento de un
// conteo, acá lo que cambia es una tasa).
function tasaEnRango(cerrados: { estado: string; fecha_cierre: string | null }[], desde: number, hasta: number) {
  const enRango = cerrados.filter((l) => {
    if (!l.fecha_cierre) return false
    const t = new Date(l.fecha_cierre).getTime()
    return t >= desde && t < hasta
  })
  const ganados = enRango.filter((l) => l.estado === 'ganado').length
  return enRango.length > 0 ? (ganados / enRango.length) * 100 : null
}

onMounted(async () => {
  const cerrados = await fetchCerrados()
  const ganados = cerrados.filter((l) => l.estado === 'ganado').length
  tasa.value = cerrados.length > 0 ? `${Math.round((ganados / cerrados.length) * 100)}%` : '—'

  const dia = 24 * 60 * 60 * 1000
  const ahora = Date.now()
  const actual = tasaEnRango(cerrados, ahora - 30 * dia, ahora)
  const anterior = tasaEnRango(cerrados, ahora - 60 * dia, ahora - 30 * dia)
  delta.value = actual !== null && anterior !== null ? Math.round(actual - anterior) : null

  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard
    label="Tasa de conversión"
    :valor="tasa"
    :delta="delta"
    delta-sufijo="pts"
    :cargando="cargando"
    icono="📈"
  />
</template>
