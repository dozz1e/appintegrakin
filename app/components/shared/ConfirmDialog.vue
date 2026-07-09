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
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 w-full max-w-sm">
        <h2 class="text-sm font-semibold text-gray-800 mb-2">{{ titulo }}</h2>
        <p class="text-sm text-gray-500 mb-6">{{ mensaje }}</p>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            :disabled="cargando"
            class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            @click="$emit('cancelar')"
          >
            Cancelar
          </button>
          <button
            type="button"
            :disabled="cargando"
            class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            @click="$emit('confirmar')"
          >
            {{ cargando ? 'Eliminando...' : textoConfirmar }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
