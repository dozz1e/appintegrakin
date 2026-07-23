<!-- app/components/capacitaciones/CalendarioMes.vue -->
<script setup lang="ts">
import type { CitaCapacitacionConNombres } from '~/composables/useCitasCapacitacion'

const props = defineProps<{
  citas: CitaCapacitacionConNombres[]
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

const citasPorDia = computed(() => {
  const conteo = new Map<string, number>()
  for (const c of props.citas) {
    const key = formatearKey(new Date(c.fecha_hora))
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

function irAHoy() {
  mesCursor.value = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  emit('update:fechaSeleccionada', keyHoy)
}

const keyHoy = formatearKey(hoy)
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-5">
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-2">
        <Icon name="mdi:calendar-blank-outline" class="w-5 h-5 text-primary" />
        <span class="text-base font-semibold text-ink">{{ MESES[mesCursor.getMonth()] }}</span>
        <select
          class="border-none bg-transparent rounded-lg px-1 py-1 text-sm text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
          :value="mesCursor.getFullYear()"
          @change="cambiarAnio(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="anio in aniosDisponibles" :key="anio" :value="anio">{{ anio }}</option>
        </select>
      </div>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="text-xs font-medium text-ink-secondary hover:text-primary px-2.5 py-1.5 rounded-lg hover:bg-surface-2 transition-colors mr-1"
          @click="irAHoy"
        >
          Hoy
        </button>
        <button
          type="button"
          class="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
          @click="mesAnterior"
        >
          <Icon name="mdi:chevron-left" class="w-5 h-5" />
        </button>
        <button
          type="button"
          class="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
          @click="mesSiguiente"
        >
          <Icon name="mdi:chevron-right" class="w-5 h-5" />
        </button>
      </div>
    </div>

    <div class="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-ink-muted mb-2">
      <span v-for="dia in DIAS_SEMANA" :key="dia">{{ dia }}</span>
    </div>

    <div class="grid grid-cols-7 gap-1.5">
      <button
        v-for="celda in celdas"
        :key="celda.key"
        type="button"
        class="min-h-[92px] rounded-xl p-2 flex flex-col items-start gap-1 border transition-colors"
        :class="[
          celda.enMes ? 'text-ink' : 'text-ink-muted/40',
          celda.key === fechaSeleccionada
            ? 'bg-primary text-ink-onprimary border-primary shadow-md'
            : celda.key === keyHoy
              ? 'border-primary/60 bg-primary-subtle/40'
              : 'border-transparent hover:bg-surface-2',
        ]"
        @click="onDiaClick(celda.key)"
      >
        <span
          class="text-sm w-6 h-6 flex items-center justify-center rounded-full"
          :class="celda.key === keyHoy && celda.key !== fechaSeleccionada ? 'bg-primary text-ink-onprimary font-semibold' : ''"
        >
          {{ celda.fecha.getDate() }}
        </span>
        <span
          v-if="citasPorDia.has(celda.key)"
          class="text-[10px] leading-none rounded-full px-1.5 py-0.5 font-medium mt-auto"
          :class="celda.key === fechaSeleccionada ? 'bg-white/20 text-ink-onprimary' : 'bg-primary-subtle text-primary-ink'"
        >
          {{ citasPorDia.get(celda.key) }} cita{{ citasPorDia.get(celda.key) === 1 ? '' : 's' }}
        </span>
      </button>
    </div>
  </div>
</template>
