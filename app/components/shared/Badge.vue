<script setup lang="ts">
defineProps<{ label: string; clases: string }>()
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium" :class="clases">
    {{ label }}
  </span>
</template>
