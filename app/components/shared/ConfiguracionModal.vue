<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ cerrar: [] }>()

const { perfil, actualizarConfiguracion } = useMiPerfil()
const { fetchConfiguracion, actualizarDias } = useConfiguracionArchivado()
const { success, error } = useToast()

const umbralMinutos = ref(30)
const guardando = ref(false)

const mostrarArchivado = computed(() => perfil.value?.roles.includes('post_venta') ?? false)
const diasLeads = ref(30)
const diasTickets = ref(30)
const diasPostVenta = ref(30)

watch(
  () => props.open,
  async (abierto) => {
    if (!abierto) return
    const valor = perfil.value?.settings?.umbral_alertas_minutos
    umbralMinutos.value = typeof valor === 'number' ? valor : 30

    if (mostrarArchivado.value) {
      const config = await fetchConfiguracion()
      diasLeads.value = config.find((c) => c.modulo === 'leads')?.dias ?? 30
      diasTickets.value = config.find((c) => c.modulo === 'tickets')?.dias ?? 30
      diasPostVenta.value = config.find((c) => c.modulo === 'tickets_post_venta')?.dias ?? 30
    }
  }
)

async function onGuardar() {
  if (umbralMinutos.value < 1) return
  if (mostrarArchivado.value && (diasLeads.value < 1 || diasTickets.value < 1 || diasPostVenta.value < 1)) return

  guardando.value = true
  try {
    await actualizarConfiguracion({ umbral_alertas_minutos: umbralMinutos.value })
    if (mostrarArchivado.value) {
      await Promise.all([
        actualizarDias('leads', diasLeads.value),
        actualizarDias('tickets', diasTickets.value),
        actualizarDias('tickets_post_venta', diasPostVenta.value),
      ])
    }
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

    <div v-if="mostrarArchivado" class="mt-4 pt-4 border-t border-border space-y-3">
      <p class="text-xs font-medium text-ink-muted">Archivar cerrados automáticamente después de (días)</p>
      <div>
        <label class="block text-xs text-ink-muted mb-1">Leads</label>
        <input
          v-model.number="diasLeads"
          type="number"
          min="1"
          class="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        />
      </div>
      <div>
        <label class="block text-xs text-ink-muted mb-1">Tickets</label>
        <input
          v-model.number="diasTickets"
          type="number"
          min="1"
          class="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        />
      </div>
      <div>
        <label class="block text-xs text-ink-muted mb-1">Post venta</label>
        <input
          v-model.number="diasPostVenta"
          type="number"
          min="1"
          class="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        />
      </div>
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
