<script setup lang="ts">
import type { Tarea } from '~/composables/useTareas'

defineProps<{ tarea: Tarea }>()
defineEmits<{ cerrar: []; click: [] }>()

// La ventana de aviso es de 30 min (ver useTareas.ts, UMBRAL_MINUTOS_PROXIMAS),
// así que en la práctica siempre cae en la rama de minutos - la rama de horas
// queda como respaldo si el umbral cambia en el futuro.
function formatearHora(fechaVencimiento: string): string {
  const msRestante = new Date(fechaVencimiento).getTime() - Date.now()
  const minutos = Math.max(1, Math.round(msRestante / 60_000))
  if (minutos < 60) return `en ${minutos} min`
  const horas = Math.round(minutos / 60)
  return `en ${horas} hora${horas === 1 ? '' : 's'}`
}
</script>

<template>
  <div
    class="border-2 border-warning-text/40 rounded-xl shadow-xl px-5 py-4 flex items-start gap-4 text-base bg-warning-bg text-warning-text"
  >
    <span class="text-2xl shrink-0">⏰</span>
    <div class="flex-1 min-w-0 cursor-pointer" @click="$emit('click')">
      <p class="font-semibold text-base truncate">{{ tarea.titulo }}</p>
      <p v-if="tarea.fecha_vencimiento" class="text-sm opacity-80 mt-0.5">
        Vence {{ formatearHora(tarea.fecha_vencimiento) }}
      </p>
    </div>
    <button class="text-lg opacity-60 hover:opacity-100 shrink-0" @click="$emit('cerrar')">✕</button>
  </div>
</template>
