<script setup lang="ts">
defineProps<{ titulo?: string }>()
</script>

<template>
  <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
    <h2 v-if="titulo" class="text-sm font-semibold text-gray-700 mb-4">{{ titulo }}</h2>
    <slot />
  </div>
</template>
