<script setup lang="ts">
import type { EventoCalendario } from '~/composables/useEventosCalendario'

const props = defineProps<{ modelValue?: Partial<EventoCalendario>; cargando?: boolean }>()
const emit = defineEmits<{ submit: [payload: Record<string, unknown>] }>()

function aFechaInput(fechaIso?: string): string {
  if (!fechaIso) return ''
  const d = new Date(fechaIso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function aHoraInput(fechaIso?: string): string {
  if (!fechaIso) return ''
  const d = new Date(fechaIso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const form = reactive({
  titulo: props.modelValue?.titulo ?? '',
  descripcion: props.modelValue?.descripcion ?? '',
  fecha: aFechaInput(props.modelValue?.fecha_hora),
  hora: aHoraInput(props.modelValue?.fecha_hora),
})

const errores = reactive<Record<string, string>>({})

function validar(): boolean {
  errores.titulo = form.titulo.trim() ? '' : 'El título es obligatorio'
  errores.fecha = form.fecha ? '' : 'La fecha es obligatoria'
  errores.hora = form.hora ? '' : 'La hora es obligatoria'
  return !Object.values(errores).some(Boolean)
}

function onSubmit() {
  if (!validar()) return
  const [anio, mes, dia] = form.fecha.split('-').map(Number)
  const [horas, minutos] = form.hora.split(':').map(Number)
  const fecha_hora = new Date(anio, mes - 1, dia, horas, minutos).toISOString()

  emit('submit', {
    titulo: form.titulo.trim(),
    descripcion: form.descripcion.trim() || null,
    fecha_hora,
  })
}

const inputClase =
  'w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium mb-1 text-ink-secondary">Título *</label>
      <input v-model="form.titulo" type="text" :class="inputClase" />
      <p v-if="errores.titulo" class="text-sm text-danger-text mt-1">{{ errores.titulo }}</p>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium mb-1 text-ink-secondary">Fecha *</label>
        <input v-model="form.fecha" type="date" :class="inputClase" @click="abrirPicker" />
        <p v-if="errores.fecha" class="text-sm text-danger-text mt-1">{{ errores.fecha }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1 text-ink-secondary">Hora *</label>
        <input v-model="form.hora" type="time" :class="inputClase" @click="abrirPicker" />
        <p v-if="errores.hora" class="text-sm text-danger-text mt-1">{{ errores.hora }}</p>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-ink-secondary">Descripción</label>
      <textarea v-model="form.descripcion" rows="3" :class="inputClase"></textarea>
    </div>

    <button
      type="submit"
      :disabled="cargando"
      class="bg-primary hover:bg-primary/90 text-ink-onprimary px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {{ cargando ? 'Guardando...' : 'Guardar evento' }}
    </button>
  </form>
</template>
