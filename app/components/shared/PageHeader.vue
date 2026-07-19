<script setup lang="ts">
defineProps<{ titulo: string; volverA?: string }>()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2 mb-6">
    <div>
      <NuxtLink
        v-if="volverA"
        :to="volverA"
        class="text-xs text-ink-muted hover:text-primary mb-1 inline-block transition-colors duration-150"
      >
        ← Volver
      </NuxtLink>
      <h1 class="text-xl font-semibold text-ink">{{ titulo }}</h1>
      <p v-if="$slots.subtitulo" class="text-xs text-ink-muted mt-0.5">
        <slot name="subtitulo" />
      </p>
    </div>
    <slot name="accion" />
  </div>
</template>
