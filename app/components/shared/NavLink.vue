<script setup lang="ts">
const props = defineProps<{ to: string; activo: boolean; icono?: string }>()
</script>

<template>
  <NuxtLink
    :to="props.to"
    class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
    :class="props.activo
      ? 'bg-primary-subtle text-primary-ink'
      : 'text-ink-secondary hover:bg-surface-2 hover:text-ink'"
  >
    <Icon v-if="icono" :name="icono" class="w-4 h-4 shrink-0" />
    <slot />
  </NuxtLink>
</template>
