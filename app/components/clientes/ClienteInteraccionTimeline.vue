<script setup lang="ts">
import type { ClienteInteraccion } from '~/composables/useClienteInteracciones'

const props = defineProps<{ clienteId: string }>()
const emit = defineEmits<{ registrada: [] }>()
const { fetchInteracciones, agregarInteraccion } = useClienteInteracciones()
const { success, error } = useToast()

const interacciones = ref<ClienteInteraccion[]>([])
const cargando = ref(true)
const guardando = ref(false)

const canal = ref<ClienteInteraccion['canal']>('correo')
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
  interacciones.value = await fetchInteracciones(props.clienteId)
  cargando.value = false
}

watch(() => props.clienteId, cargar, { immediate: true })

async function onSubmit() {
  if (!nota.value.trim()) return
  guardando.value = true
  try {
    await agregarInteraccion(props.clienteId, canal.value, nota.value.trim())
    nota.value = ''
    await cargar()
    emit('registrada')
    success('Interacción registrada')
  } catch (e) {
    error('No se pudo registrar la interacción')
  } finally {
    guardando.value = false
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div>
    <div class="flex flex-wrap gap-2 mb-4">
      <select
        v-model="canal"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
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
        placeholder="¿Qué se conversó?"
        class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        @keyup.enter="onSubmit"
      />
      <button
        :disabled="guardando || !nota.trim()"
        class="bg-primary hover:bg-primary-hover text-ink-onprimary px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
      </li>
    </ul>
  </div>
</template>
