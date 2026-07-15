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

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
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
  const set = new Set<string>()
  for (const c of props.citas) {
    set.add(formatearKey(new Date(c.fecha_hora)))
  }
  return set
})

interface CeldaCalendario {
  fecha: Date
  key: string
  enMes: boolean
}

const celdas = computed<CeldaCalendario[]>(() => {
  const primerDiaMes = new Date(mesCursor.value.getFullYear(), mesCursor.value.getMonth(), 1)
  const inicioGrilla = new Date(primerDiaMes)
  inicioGrilla.setDate(inicioGrilla.getDate() - primerDiaMes.getDay())

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
  <div class="border border-gray-100 rounded-xl p-4">
    <div class="flex items-center justify-between mb-4">
      <button type="button" class="text-gray-400 hover:text-gray-700 px-2 text-lg" @click="mesAnterior">‹</button>
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-gray-800">{{ MESES[mesCursor.getMonth()] }}</span>
        <select
          class="border border-gray-200 rounded-lg px-2 py-1 text-sm"
          :value="mesCursor.getFullYear()"
          @change="cambiarAnio(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="anio in aniosDisponibles" :key="anio" :value="anio">{{ anio }}</option>
        </select>
      </div>
      <button type="button" class="text-gray-400 hover:text-gray-700 px-2 text-lg" @click="mesSiguiente">›</button>
    </div>

    <div class="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
      <span v-for="dia in DIAS_SEMANA" :key="dia">{{ dia }}</span>
    </div>

    <div class="grid grid-cols-7 gap-1">
      <button
        v-for="celda in celdas"
        :key="celda.key"
        type="button"
        class="min-h-[90px] rounded-lg p-2 flex flex-col items-center gap-1 border transition-colors"
        :class="[
          celda.enMes ? 'text-gray-800' : 'text-gray-300',
          celda.key === fechaSeleccionada
            ? 'bg-[#1075B5] text-white border-[#1075B5]'
            : celda.key === keyHoy
              ? 'border-[#1075B5] border-2'
              : 'border-gray-100 hover:bg-gray-50',
        ]"
        @click="onDiaClick(celda.key)"
      >
        <span class="text-sm">{{ celda.fecha.getDate() }}</span>
        <span
          v-if="citasPorDia.has(celda.key)"
          class="w-1.5 h-1.5 rounded-full"
          :class="celda.key === fechaSeleccionada ? 'bg-white' : 'bg-[#1075B5]'"
        />
      </button>
    </div>
  </div>
</template>
