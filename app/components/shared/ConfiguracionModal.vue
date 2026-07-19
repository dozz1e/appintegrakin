<script setup lang="ts">
import type { UmbralAlerta } from '~/composables/useUmbralesAlertas'
import { UMBRAL_ALERTA_DEFAULT } from '~/composables/useUmbralesAlertas'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ cerrar: [] }>()

const { perfil, actualizarConfiguracion } = useMiPerfil()
const { fetchConfiguracion, actualizarDias } = useConfiguracionArchivado()
const { fetchDiasInactividadLeads, actualizarDiasInactividadLeads } = useConfiguracionAlertas()
const { can } = usePermissions()
const { success, error } = useToast()

const umbrales = ref<UmbralAlerta[]>([{ ...UMBRAL_ALERTA_DEFAULT }])
const guardando = ref(false)

const mostrarArchivado = computed(() => perfil.value?.roles.includes('post_venta') ?? false)
const diasLeads = ref(30)
const diasTickets = ref(30)
const diasPostVenta = ref(30)

const mostrarInactividadLeads = computed(() => can('configuracion_alertas', 'edit'))
const diasInactividadLeads = ref(4)

watch(
  () => props.open,
  async (abierto) => {
    if (!abierto) return
    const config = perfil.value?.settings?.umbrales_alertas
    umbrales.value = Array.isArray(config) && config.length > 0
      ? structuredClone(config as UmbralAlerta[])
      : [{ ...UMBRAL_ALERTA_DEFAULT }]

    if (mostrarArchivado.value) {
      const config = await fetchConfiguracion()
      diasLeads.value = config.find((c) => c.modulo === 'leads')?.dias ?? 30
      diasTickets.value = config.find((c) => c.modulo === 'tickets')?.dias ?? 30
      diasPostVenta.value = config.find((c) => c.modulo === 'tickets_post_venta')?.dias ?? 30
    }

    if (mostrarInactividadLeads.value) {
      diasInactividadLeads.value = await fetchDiasInactividadLeads()
    }
  }
)

function agregarUmbral() {
  umbrales.value.push({ valor: 15, unidad: 'minutos' })
}
function quitarUmbral(i: number) {
  if (umbrales.value.length > 1) umbrales.value.splice(i, 1)
}

async function onGuardar() {
  if (umbrales.value.some((u) => u.valor < 1)) return
  if (mostrarArchivado.value && (diasLeads.value < 1 || diasTickets.value < 1 || diasPostVenta.value < 1)) return
  if (mostrarInactividadLeads.value && diasInactividadLeads.value < 1) return

  guardando.value = true
  try {
    await actualizarConfiguracion({ umbrales_alertas: umbrales.value })
    if (mostrarArchivado.value) {
      await Promise.all([
        actualizarDias('leads', diasLeads.value),
        actualizarDias('tickets', diasTickets.value),
        actualizarDias('tickets_post_venta', diasPostVenta.value),
      ])
    }
    if (mostrarInactividadLeads.value) {
      await actualizarDiasInactividadLeads(diasInactividadLeads.value)
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
        Avisar tareas y citas próximas a vencer con esta anticipación
      </label>
      <div v-for="(u, i) in umbrales" :key="i" class="flex items-center gap-2 mb-2">
        <input
          v-model.number="u.valor"
          type="number"
          min="1"
          class="w-20 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        />
        <select
          v-model="u.unidad"
          class="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        >
          <option value="minutos">Minutos</option>
          <option value="horas">Horas</option>
          <option value="dias">Días</option>
        </select>
        <button
          type="button"
          :disabled="umbrales.length === 1"
          class="text-ink-muted hover:text-danger-text disabled:opacity-30 disabled:cursor-not-allowed px-1"
          @click="quitarUmbral(i)"
        >
          ✕
        </button>
      </div>
      <button type="button" class="text-sm text-primary hover:underline" @click="agregarUmbral">
        + Agregar umbral
      </button>
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

    <div v-if="mostrarInactividadLeads" class="mt-4 pt-4 border-t border-border">
      <label class="block text-xs font-medium text-ink-muted mb-1">
        Avisar leads sin actividad después de (días)
      </label>
      <input
        v-model.number="diasInactividadLeads"
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
