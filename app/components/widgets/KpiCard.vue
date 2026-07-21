<script setup lang="ts">
defineProps<{
  label: string
  valor: number | string
  cargando?: boolean
  icono?: string // un solo caracter/emoji, mantiene el componente sin depender de una librería de iconos
  delta?: number | null // % vs. período anterior (30 días). null/undefined = no se muestra
  deltaSufijo?: string // 'pts' para deltas en puntos porcentuales, '%' por defecto
}>()
</script>

<template>
  <div class="bg-surface border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <p class="text-xs text-ink-muted">{{ label }}</p>
      <div class="w-8 h-8 rounded-full bg-primary-subtle text-primary-ink flex items-center justify-center text-sm shrink-0">
        {{ icono ?? '📊' }}
      </div>
    </div>

    <p class="text-2xl font-semibold text-ink">
      <span v-if="cargando" class="text-ink-muted text-base">...</span>
      <span v-else>{{ valor }}</span>
    </p>

    <p
      v-if="!cargando && delta !== null && delta !== undefined"
      class="inline-flex w-fit items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5"
      :class="delta >= 0 ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'"
    >
      <Icon :name="delta >= 0 ? 'mdi:trending-up' : 'mdi:trending-down'" class="w-3.5 h-3.5" />
      {{ delta >= 0 ? '+' : '' }}{{ delta }}{{ deltaSufijo ?? '%' }}
    </p>
  </div>
</template>
