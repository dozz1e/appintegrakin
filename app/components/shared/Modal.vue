<script setup lang="ts">
defineProps<{ open: boolean; titulo: string }>()
defineEmits<{ cerrar: [] }>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      @click.self="$emit('cerrar')"
    >
      <div class="bg-surface rounded-2xl border border-border shadow-lg p-6 w-full max-w-sm">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-ink">{{ titulo }}</h2>
          <button
            type="button"
            class="text-ink-muted hover:text-ink transition-colors duration-150"
            @click="$emit('cerrar')"
          >
            <Icon name="mdi:close" class="w-5 h-5" />
          </button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
