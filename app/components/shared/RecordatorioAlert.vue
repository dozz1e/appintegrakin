<script setup lang="ts">
import type { Tarea } from '~/composables/useTareas'

const props = defineProps<{ tarea: Tarea }>()
defineEmits<{ cerrar: []; click: [] }>()

const esVencida = computed(
  () => !!props.tarea.fecha_vencimiento && new Date(props.tarea.fecha_vencimiento).getTime() < Date.now()
)

// La ventana de aviso "próxima" es de 30 min (ver useTareas.ts,
// UMBRAL_MINUTOS_PROXIMAS), así que en la práctica esa rama siempre cae en
// minutos - la rama de horas queda como respaldo, y aplica sin límite al
// lado "vencida hace X" ya que esas no tienen tope de tiempo hacia atrás.
function formatearHora(fechaVencimiento: string): string {
  const msDiferencia = Math.abs(new Date(fechaVencimiento).getTime() - Date.now())
  const minutos = Math.max(1, Math.round(msDiferencia / 60_000))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.round(minutos / 60)
  return `${horas} hora${horas === 1 ? '' : 's'}`
}
</script>

<template>
  <div
    class="border-2 rounded-xl shadow-xl px-5 py-4 flex items-start gap-4 text-base"
    :class="
      esVencida
        ? 'border-danger-text/40 bg-danger-bg text-danger-text'
        : 'border-warning-text/40 bg-warning-bg text-warning-text'
    "
  >
    <span class="text-2xl shrink-0">{{ esVencida ? '⚠️' : '⏰' }}</span>
    <div class="flex-1 min-w-0 cursor-pointer" @click="$emit('click')">
      <p class="font-semibold text-base truncate">{{ tarea.titulo }}</p>
      <p v-if="tarea.fecha_vencimiento" class="text-sm opacity-80 mt-0.5">
        {{ esVencida ? 'Venció hace' : 'Vence en' }} {{ formatearHora(tarea.fecha_vencimiento) }}
      </p>
    </div>
    <button class="text-lg opacity-60 hover:opacity-100 shrink-0" @click="$emit('cerrar')">✕</button>
  </div>
</template>
