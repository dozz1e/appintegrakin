<script setup lang="ts">
import type { LeadInteraccion } from '~/composables/useLeadInteracciones'

const props = defineProps<{ leadId: string }>()
const { fetchInteracciones, agregarInteraccion, eliminarInteraccion } = useLeadInteracciones()
const { success, error } = useToast()

const interacciones = ref<LeadInteraccion[]>([])
const cargando = ref(true)
const guardando = ref(false)
const aEliminar = ref<LeadInteraccion | null>(null)
const eliminando = ref(false)

const canal = ref<'whatsapp' | 'instagram' | 'facebook' | 'llamada' | 'web' | 'correo'>('correo')
const nota = ref('')

const iconoCanal: Record<string, string> = {
  whatsapp: 'mdi:whatsapp',
  instagram: 'mdi:instagram',
  facebook: 'mdi:facebook',
  llamada: 'mdi:phone-outline',
  web: 'mdi:web',
  correo: 'mdi:email-outline',
}

async function cargar() {
  cargando.value = true
  interacciones.value = await fetchInteracciones(props.leadId)
  cargando.value = false
}

onMounted(cargar)

async function onSubmit() {
  if (!nota.value.trim()) return
  guardando.value = true
  try {
    await agregarInteraccion(props.leadId, canal.value, nota.value.trim())
    nota.value = ''
    await cargar()
    success('Interacción registrada')
  } catch (e) {
    error('No se pudo registrar la interacción')
  } finally {
    guardando.value = false
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

async function onConfirmarEliminar() {
  if (!aEliminar.value) return
  eliminando.value = true
  try {
    await eliminarInteraccion(aEliminar.value.id)
    interacciones.value = interacciones.value.filter((i) => i.id !== aEliminar.value?.id)
    aEliminar.value = null
    success('Interacción eliminada')
  } catch (e) {
    error('No se pudo eliminar la interacción')
  } finally {
    eliminando.value = false
  }
}
</script>

<template>
  <SharedCard titulo="Historial de interacciones">
    <div class="flex flex-wrap gap-2 mb-4">
      <select
        v-model="canal"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
      >
        <option value="whatsapp">WhatsApp</option>
        <option value="instagram">Instagram</option>
        <option value="facebook">Facebook</option>
        <option value="llamada">Llamada</option>
        <option value="web">Web</option>
        <option value="correo">Correo</option>
      </select>
      <input
        v-model="nota"
        type="text"
        placeholder="¿Qué respondió el cliente?"
        class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        @keyup.enter="onSubmit"
      />
      <button
        :disabled="guardando || !nota.trim()"
        class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        @click="onSubmit"
      >
        {{ guardando ? 'Guardando...' : 'Agregar' }}
      </button>
    </div>

    <p v-if="cargando" class="text-sm text-gray-400">Cargando historial...</p>
    <p v-else-if="!interacciones.length" class="text-sm text-gray-400">Sin interacciones registradas todavía.</p>

    <ul v-else class="space-y-3">
      <li
        v-for="i in interacciones"
        :key="i.id"
        class="flex gap-3 border-l-2 pl-3"
        :class="colorCanal(i.canal).clases.split(' ')[1]?.replace('text-', 'border-')"
      >
        <Icon :name="iconoCanal[i.canal]" class="w-5 h-5 mt-0.5 flex-shrink-0" :class="colorCanal(i.canal).clases.split(' ')[1]" />
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <SharedBadge :label="colorCanal(i.canal).label" :clases="colorCanal(i.canal).clases" />
            <span class="text-xs text-gray-400">{{ formatearFecha(i.created_at) }}</span>
          </div>
          <p class="text-sm text-gray-700 mt-1">{{ i.nota }}</p>
        </div>
        <button
          type="button"
          class="text-gray-300 hover:text-danger transition-colors shrink-0"
          title="Eliminar"
          @click="aEliminar = i"
        >
          <Icon name="mdi:trash-can-outline" class="w-4 h-4" />
        </button>
      </li>
    </ul>

    <SharedConfirmDialog
      :open="!!aEliminar"
      titulo="Eliminar interacción"
      mensaje="¿Eliminar esta interacción? Esta acción no se puede deshacer."
      :cargando="eliminando"
      @confirmar="onConfirmarEliminar"
      @cancelar="aEliminar = null"
    />
  </SharedCard>
</template>