<script setup lang="ts">
export interface AvisoRecordatorio {
  id: string
  titulo: string
  fecha_vencimiento: string | null
}

const props = defineProps<{ aviso: AvisoRecordatorio }>()
defineEmits<{ cerrar: []; click: [] }>()

const esVencida = computed(
  () => !!props.aviso.fecha_vencimiento && new Date(props.aviso.fecha_vencimiento).getTime() < Date.now()
)

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
      <p class="font-semibold text-base truncate">{{ aviso.titulo }}</p>
      <p v-if="aviso.fecha_vencimiento" class="text-sm opacity-80 mt-0.5">
        {{ esVencida ? 'Venció hace' : 'Vence en' }} {{ formatearHora(aviso.fecha_vencimiento) }}
      </p>
    </div>
    <button class="text-lg opacity-60 hover:opacity-100 shrink-0" @click="$emit('cerrar')">✕</button>
  </div>
</template>
