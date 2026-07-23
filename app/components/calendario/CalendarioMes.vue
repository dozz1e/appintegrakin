<!-- app/components/calendario/CalendarioMes.vue -->
<script setup lang="ts">
import type { EventoCalendario } from '~/composables/useEventosCalendario'

const props = defineProps<{
  eventos: EventoCalendario[]
  fechaSeleccionada: string | null
}>()

const emit = defineEmits<{
  'update:fechaSeleccionada': [fecha: string | null]
}>()

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const hoy = new Date()
const mesCursor = ref(new Date(hoy.getFullYear(), hoy.getMonth(), 1))

const aniosDisponibles = computed(() => {
  const actual = hoy.getFullYear()
  const anios: number[] = []
  for (let a = actual - 5; a <= actual + 5; a++) anios.push(a)
  return anios
})

function mesAnterior() {
  mesCursor.value = new Date(mesCursor.value.getFullYear(), mesCursor.value.getMonth() - 1, 1)
}

function mesSiguiente() {
  mesCursor.value = new Date(mesCursor.value.getFullYear(), mesCursor.value.getMonth() + 1, 1)
}

function cambiarAnio(anio: number) {
  mesCursor.value = new Date(anio, mesCursor.value.getMonth(), 1)
}

function formatearKey(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const eventosPorDia = computed(() => {
  const conteo = new Map<string, number>()
  for (const e of props.eventos) {
    const key = formatearKey(new Date(e.fecha_hora))
    conteo.set(key, (conteo.get(key) ?? 0) + 1)
  }
  return conteo
})

interface CeldaCalendario {
  fecha: Date
  key: string
  enMes: boolean
}

const celdas = computed<CeldaCalendario[]>(() => {
  const primerDiaMes = new Date(mesCursor.value.getFullYear(), mesCursor.value.getMonth(), 1)
  const inicioGrilla = new Date(primerDiaMes)
  inicioGrilla.setDate(inicioGrilla.getDate() - ((primerDiaMes.getDay() + 6) % 7))

  const resultado: CeldaCalendario[] = []
  const cursor = new Date(inicioGrilla)
  for (let i = 0; i < 42; i++) {
    resultado.push({
      fecha: new Date(cursor),
      key: formatearKey(cursor),
      enMes: cursor.getMonth() === mesCursor.value.getMonth(),
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return resultado
})

function onDiaClick(key: string) {
  emit('update:fechaSeleccionada', props.fechaSeleccionada === key ? null : key)
}

const keyHoy = formatearKey(hoy)
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-4">
    <div class="flex items-center justify-between mb-4">
      <button type="button" class="text-ink-muted hover:text-ink px-2 text-lg" @click="mesAnterior">‹</button>
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-ink">{{ MESES[mesCursor.getMonth()] }}</span>
        <select
          class="border border-border rounded-lg px-2 py-1 text-sm bg-surface text-ink-secondary"
          :value="mesCursor.getFullYear()"
          @change="cambiarAnio(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="anio in aniosDisponibles" :key="anio" :value="anio">{{ anio }}</option>
        </select>
      </div>
      <button type="button" class="text-ink-muted hover:text-ink px-2 text-lg" @click="mesSiguiente">›</button>
    </div>

    <div class="grid grid-cols-7 gap-1 text-center text-xs text-ink-muted mb-1">
      <span v-for="dia in DIAS_SEMANA" :key="dia">{{ dia }}</span>
    </div>

    <div class="grid grid-cols-7 gap-1">
      <button
        v-for="celda in celdas"
        :key="celda.key"
        type="button"
        class="min-h-[90px] rounded-lg p-2 flex flex-col items-center gap-1 border transition-colors"
        :class="[
          celda.enMes ? 'text-ink' : 'text-ink-muted/50',
          celda.key === fechaSeleccionada
            ? 'bg-primary text-ink-onprimary border-primary'
            : celda.key === keyHoy
              ? 'border-primary border-2'
              : 'border-border hover:bg-neutral-bg',
        ]"
        @click="onDiaClick(celda.key)"
      >
        <span class="text-sm">{{ celda.fecha.getDate() }}</span>
        <span
          v-if="eventosPorDia.has(celda.key)"
          class="text-[10px] leading-none rounded-full px-1.5 py-0.5"
          :class="celda.key === fechaSeleccionada ? 'bg-white/20 text-ink-onprimary' : 'bg-primary-subtle text-primary-ink'"
        >
          {{ eventosPorDia.get(celda.key) }}
        </span>
      </button>
    </div>
  </div>
</template>
