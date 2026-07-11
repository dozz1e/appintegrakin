<script setup lang="ts">
defineProps<{ titulo?: string }>()
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-6">
    <h2 v-if="titulo" class="text-sm font-semibold text-ink mb-4">{{ titulo }}</h2>
    <slot />
  </div>
</template>
