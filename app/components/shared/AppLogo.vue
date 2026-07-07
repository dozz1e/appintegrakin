<script setup lang="ts">
defineProps<{ size?: 'sm' | 'md' }>()
</script>

<template>
  <img
    src="https://integrakin.cl/wp-content/uploads/2024/09/Logo-Integrakin-2024-Sel-01-768x106.png"
    alt="Integrakin"
    :class="size === 'sm' ? 'h-6' : 'h-8'"
    class="w-auto object-contain"
  />
</template>
