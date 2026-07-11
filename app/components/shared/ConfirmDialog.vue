<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean
    titulo: string
    mensaje: string
    textoConfirmar?: string
    cargando?: boolean
  }>(),
  { textoConfirmar: 'Eliminar', cargando: false }
)

defineEmits<{ confirmar: []; cancelar: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
      <div class="bg-surface rounded-2xl border border-border shadow-lg p-6 w-full max-w-sm">
        <h2 class="text-sm font-semibold text-ink mb-2">{{ titulo }}</h2>
        <p class="text-sm text-ink-secondary mb-6">{{ mensaje }}</p>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            :disabled="cargando"
            class="border border-border text-ink-secondary hover:bg-surface-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
            @click="$emit('cancelar')"
          >
            Cancelar
          </button>
          <button
            type="button"
            :disabled="cargando"
            class="bg-danger hover:bg-danger-hover text-ink-onprimary px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
            @click="$emit('confirmar')"
          >
            {{ cargando ? 'Eliminando...' : textoConfirmar }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
