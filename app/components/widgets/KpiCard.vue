<script setup lang="ts">
defineProps<{
  label: string
  valor: number | string
  cargando?: boolean
  icono?: string // un solo caracter/emoji, mantiene el componente sin depender de una librería de iconos
}>()
</script>

<template>
  <div class="bg-white border border-gray-100 rounded-2xl p-3 flex flex-col items-center text-center gap-1 shadow-sm">
    <div class="w-8 h-8 rounded-full bg-[#EAF4FA] text-[#0C5D91] flex items-center justify-center text-sm shrink-0">
      {{ icono ?? '📊' }}
    </div>
    <p class="text-xs text-gray-400">{{ label }}</p>
    <p class="text-lg font-semibold text-gray-800">
      <span v-if="cargando" class="text-gray-300">...</span>
      <span v-else>{{ valor }}</span>
    </p>
  </div>
</template>
