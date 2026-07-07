<script setup lang="ts">
defineProps<{
  label: string
  valor: number | string
  cargando?: boolean
  icono?: string // un solo caracter/emoji, mantiene el componente sin depender de una librería de iconos
}>()
</script>

<template>
  <div class="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
    <div class="w-11 h-11 rounded-full bg-[#EAF4FA] text-[#0C5D91] flex items-center justify-center text-lg shrink-0">
      {{ icono ?? '📊' }}
    </div>
    <div>
      <p class="text-xs text-gray-400 mb-0.5">{{ label }}</p>
      <p class="text-2xl font-semibold text-gray-800">
        <span v-if="cargando" class="text-gray-300">...</span>
        <span v-else>{{ valor }}</span>
      </p>
    </div>
  </div>
</template>
