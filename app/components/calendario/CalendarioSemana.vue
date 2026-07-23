<!-- app/components/calendario/CalendarioSemana.vue -->
<script setup lang="ts">
import type { EventoCalendario } from '~/composables/useEventosCalendario'

const props = defineProps<{
  eventos: EventoCalendario[]
  fechaSeleccionada: string | null
  modo: 'dia' | 'semana'
}>()

const emit = defineEmits<{
  'update:fechaSeleccionada': [fecha: string | null]
  'editar-evento': [evento: EventoCalendario]
}>()

const DIAS_SEMANA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const HORAS = Array.from({ length: 14 }, (_, i) => i + 7) // 07:00 .. 20:00

const hoy = new Date()
const cursor = ref(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()))

function formatearKey(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const keyHoy = formatearKey(hoy)

const diasVista = computed<Date[]>(() => {
  if (props.modo === 'dia') return [new Date(cursor.value)]
  const inicioSemana = new Date(cursor.value)
  inicioSemana.setDate(inicioSemana.getDate() - ((inicioSemana.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana)
    d.setDate(d.getDate() + i)
    return d
  })
})

function anterior() {
  const dias = props.modo === 'dia' ? 1 : 7
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), cursor.value.getDate() - dias)
}

function siguiente() {
  const dias = props.modo === 'dia' ? 1 : 7
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), cursor.value.getDate() + dias)
}

function irAHoy() {
  cursor.value = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  emit('update:fechaSeleccionada', keyHoy)
}

const tituloRango = computed(() => {
  const dias = diasVista.value
  if (props.modo === 'dia') {
    const d = dias[0]!
    return `${d.getDate()} de ${MESES[d.getMonth()]}, ${d.getFullYear()}`
  }
  const inicio = dias[0]!
  const fin = dias[6]!
  if (inicio.getMonth() === fin.getMonth()) {
    return `${inicio.getDate()} - ${fin.getDate()} de ${MESES[inicio.getMonth()]}, ${inicio.getFullYear()}`
  }
  return `${inicio.getDate()} ${MESES[inicio.getMonth()]} - ${fin.getDate()} ${MESES[fin.getMonth()]}, ${fin.getFullYear()}`
})

interface EventoUbicado {
  evento: EventoCalendario
  hora: number
}

const eventosPorDia = computed(() => {
  const mapa = new Map<string, EventoUbicado[]>()
  for (const key of diasVista.value.map(formatearKey)) mapa.set(key, [])
  for (const e of props.eventos) {
    const fecha = new Date(e.fecha_hora)
    const key = formatearKey(fecha)
    if (!mapa.has(key)) continue
    mapa.get(key)!.push({ evento: e, hora: fecha.getHours() })
  }
  return mapa
})

function eventosEnCelda(diaKey: string, hora: number): EventoCalendario[] {
  return (eventosPorDia.value.get(diaKey) ?? [])
    .filter((u) => u.hora === hora)
    .map((u) => u.evento)
}

function formatearHora(hora: number): string {
  return `${String(hora).padStart(2, '0')}:00`
}

function formatearHoraEvento(fechaIso: string): string {
  const d = new Date(fechaIso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function seleccionarDia(key: string) {
  emit('update:fechaSeleccionada', props.fechaSeleccionada === key ? null : key)
}

function onClickEvento(e: EventoCalendario, diaKey: string) {
  emit('update:fechaSeleccionada', diaKey)
  emit('editar-evento', e)
}
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-5">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <Icon :name="modo === 'dia' ? 'mdi:calendar-today-outline' : 'mdi:calendar-week-outline'" class="w-5 h-5 text-primary" />
        <span class="text-base font-semibold text-ink capitalize">{{ tituloRango }}</span>
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
          @click="anterior"
        >
          <Icon name="mdi:chevron-left" class="w-5 h-5" />
        </button>
        <button
          type="button"
          class="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
          @click="siguiente"
        >
          <Icon name="mdi:chevron-right" class="w-5 h-5" />
        </button>
      </div>
    </div>

    <div class="overflow-x-auto">
      <div class="min-w-[560px]">
        <div
          class="grid sticky top-0 bg-surface z-10 border-b border-border pb-2 mb-1"
          :style="{ gridTemplateColumns: `56px repeat(${diasVista.length}, minmax(120px, 1fr))` }"
        >
          <span></span>
          <button
            v-for="dia in diasVista"
            :key="formatearKey(dia)"
            type="button"
            class="flex flex-col items-center gap-1 py-1 rounded-lg transition-colors"
            :class="formatearKey(dia) === fechaSeleccionada ? 'bg-primary text-ink-onprimary' : 'hover:bg-surface-2'"
            @click="seleccionarDia(formatearKey(dia))"
          >
            <span class="text-[11px] font-medium uppercase" :class="formatearKey(dia) === fechaSeleccionada ? 'text-ink-onprimary/80' : 'text-ink-muted'">
              {{ DIAS_SEMANA_CORTO[(dia.getDay() + 6) % 7] }}
            </span>
            <span
              class="text-sm w-7 h-7 flex items-center justify-center rounded-full"
              :class="[
                formatearKey(dia) === keyHoy && formatearKey(dia) !== fechaSeleccionada ? 'bg-primary-subtle text-primary-ink font-semibold' : '',
                formatearKey(dia) === fechaSeleccionada ? 'font-semibold' : '',
              ]"
            >
              {{ dia.getDate() }}
            </span>
          </button>
        </div>

        <div class="max-h-[520px] overflow-y-auto">
          <div
            v-for="hora in HORAS"
            :key="hora"
            class="grid border-b border-border/60"
            :style="{ gridTemplateColumns: `56px repeat(${diasVista.length}, minmax(120px, 1fr))` }"
          >
            <span class="text-[11px] text-ink-muted pt-1.5 pr-2 text-right">{{ formatearHora(hora) }}</span>
            <div
              v-for="dia in diasVista"
              :key="formatearKey(dia) + '-' + hora"
              class="min-h-[48px] border-l border-border/60 p-1 hover:bg-surface-2/60 transition-colors cursor-pointer"
              @click="seleccionarDia(formatearKey(dia))"
            >
              <button
                v-for="e in eventosEnCelda(formatearKey(dia), hora)"
                :key="e.id"
                type="button"
                class="w-full text-left bg-primary-subtle text-primary-ink rounded-md px-2 py-1 mb-1 text-xs hover:bg-primary/20 transition-colors"
                @click.stop="onClickEvento(e, formatearKey(dia))"
              >
                <p class="font-medium truncate">{{ e.titulo }}</p>
                <p class="text-[10px] opacity-80">{{ formatearHoraEvento(e.fecha_hora) }}</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
