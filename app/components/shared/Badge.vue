<script setup lang="ts">
withDefaults(defineProps<{ label: string; clases: string; tamano?: 'sm' | 'lg' }>(), {
  tamano: 'sm',
})
</script>

<template>
  <span
    class="inline-flex items-center rounded-full font-medium"
    :class="[clases, tamano === 'lg' ? 'px-4 py-1.5 text-sm uppercase tracking-wide' : 'px-2.5 py-1 text-xs']"
  >
    {{ label }}
  </span>
</template>
