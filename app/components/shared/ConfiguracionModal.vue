<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ cerrar: [] }>()

const { perfil, actualizarConfiguracion } = useMiPerfil()
const { success, error } = useToast()

const umbralMinutos = ref(30)
const guardando = ref(false)

watch(
  () => props.open,
  (abierto) => {
    if (!abierto) return
    const valor = perfil.value?.settings?.umbral_alertas_minutos
    umbralMinutos.value = typeof valor === 'number' ? valor : 30
  }
)

async function onGuardar() {
  if (umbralMinutos.value < 1) return
  guardando.value = true
  try {
    await actualizarConfiguracion({ umbral_alertas_minutos: umbralMinutos.value })
    success('Configuración guardada')
    emit('cerrar')
  } catch (e) {
    error('No se pudo guardar la configuración')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <SharedModal :open="open" titulo="Configuración" @cerrar="$emit('cerrar')">
    <div>
      <label class="block text-xs font-medium text-ink-muted mb-1">
        Avisar tareas próximas a vencer con cuántos minutos de anticipación
      </label>
      <input
        v-model.number="umbralMinutos"
        type="number"
        min="1"
        class="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
      />
    </div>

    <div class="flex justify-end mt-6">
      <button
        type="button"
        :disabled="guardando"
        class="bg-primary hover:bg-primary-hover text-ink-onprimary px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50"
        @click="onGuardar"
      >
        {{ guardando ? 'Guardando...' : 'Guardar' }}
      </button>
    </div>
  </SharedModal>
</template>
