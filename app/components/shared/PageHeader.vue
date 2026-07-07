<script setup lang="ts">
defineProps<{ titulo: string; volverA?: string }>()
</script>

<template>
  <div class="flex items-center justify-between mb-6">
    <div>
      <NuxtLink
        v-if="volverA"
        :to="volverA"
        class="text-xs text-gray-400 hover:text-[#1075B5] mb-1 inline-block"
      >
        ← Volver
      </NuxtLink>
      <h1 class="text-xl font-semibold text-gray-800">{{ titulo }}</h1>
    </div>
    <slot name="accion" />
  </div>
</template>
