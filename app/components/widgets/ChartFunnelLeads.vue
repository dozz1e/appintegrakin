<script setup lang="ts">
const { fetchFunnel } = useReportes()
const funnel = ref<FunnelItem[]>([])
const cargando = ref(true)

const labelsEstado: Record<string, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', cotizado: 'Cotizado',
  negociacion: 'Negociación', ganado: 'Ganado',
}
const ordenPipeline = ['nuevo', 'contactado', 'cotizado', 'negociacion', 'ganado']
// Rampa secuencial de un solo hue (el primary de la marca), claro -> oscuro
// por avance de etapa - no codifica magnitud (eso ya lo hace el ancho de la
// barra), solo refuerza visualmente el progreso dentro del pipeline.
const colores = [20, 40, 60, 80, 100].map((pct) => `color-mix(in oklch, #1075b5 ${pct}%, white)`)

onMounted(async () => {
  funnel.value = await fetchFunnel()
  cargando.value = false
})

const totalesPorEstado = computed(() => new Map(funnel.value.map((f) => [f.estado, f.total])))

const perdidos = computed(() => totalesPorEstado.value.get('perdido') ?? 0)

// Cada etapa cuenta los leads que llegaron al menos hasta ahí (su propio
// total + el de todas las etapas siguientes del pipeline) - así el ancho
// de las barras es siempre decreciente, forma de embudo real. "perdido"
// no es una etapa del pipeline (se puede perder desde cualquier punto
// anterior), se muestra aparte en vez de romper la forma del embudo.
const etapas = computed(() =>
  ordenPipeline.map((estado, i) => {
    const total = ordenPipeline
      .slice(i)
      .reduce((acc, e) => acc + (totalesPorEstado.value.get(e) ?? 0), 0)
    return { estado, label: labelsEstado[estado], total }
  })
)

const totalInicial = computed(() => etapas.value[0]?.total || 1)

function anchoPct(total: number): number {
  return Math.round((total / totalInicial.value) * 100)
}

function conversion(i: number): number | null {
  if (i === 0) return null
  const anterior = etapas.value[i - 1].total
  if (!anterior) return null
  return Math.round((etapas.value[i].total / anterior) * 100)
}
</script>

<template>
  <div class="border rounded-lg p-4">
    <p class="text-xs text-gray-500 mb-3">Funnel de leads</p>
    <p v-if="cargando" class="text-gray-400 text-sm">Cargando...</p>

    <div v-else-if="!totalInicial" class="text-sm text-gray-400">Sin leads todavía.</div>

    <div v-else class="space-y-1">
      <template v-for="(etapa, i) in etapas" :key="etapa.estado">
        <div class="flex items-center gap-3">
          <span class="w-24 shrink-0 text-xs text-gray-600 text-right">{{ etapa.label }}</span>
          <div class="flex-1 h-7 bg-gray-50 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full flex items-center justify-end px-2 transition-all"
              :style="{ width: Math.max(anchoPct(etapa.total), 8) + '%', backgroundColor: colores[i] }"
            >
              <span class="text-xs font-medium" :class="i >= 3 ? 'text-white' : 'text-gray-700'">
                {{ etapa.total }}
              </span>
            </div>
          </div>
        </div>
        <p v-if="i > 0" class="text-[11px] text-gray-400 ml-[6.75rem] pl-3">
          {{ conversion(i) !== null ? `${conversion(i)}% avanzó desde ${etapas[i - 1].label}` : 'Sin datos previos' }}
        </p>
      </template>
    </div>

    <p v-if="perdidos > 0" class="text-xs text-red-600 mt-3 pt-3 border-t border-gray-100">
      {{ perdidos }} lead{{ perdidos === 1 ? '' : 's' }} perdido{{ perdidos === 1 ? '' : 's' }} (no forma{{ perdidos === 1 ? '' : 'n' }} parte del embudo, se puede perder desde cualquier etapa)
    </p>
  </div>
</template>
