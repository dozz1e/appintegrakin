<script setup lang="ts">
defineProps<{ size?: 'sm' | 'md' }>()
</script>

<template>
  <img
    src="/assets/images/logo.webp"
    alt="Integrakin Logo"
    :class="size === 'sm' ? 'h-6' : 'h-8'"
    class="w-auto object-contain"
  />
</template>
