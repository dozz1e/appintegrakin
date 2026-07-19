<!-- app/components/post-venta/SeguimientoTimeline.vue -->
<script setup lang="ts">
import type { TicketPostVentaSeguimiento } from '~/composables/useTicketsPostVenta'

const props = defineProps<{ ticketId: string }>()
const emit = defineEmits<{ registrado: [] }>()
const { fetchSeguimientos, agregarSeguimiento } = useTicketsPostVenta()
const { success, error } = useToast()

const seguimientos = ref<TicketPostVentaSeguimiento[]>([])
const cargando = ref(true)
const guardando = ref(false)

const fecha = ref(new Date().toISOString().slice(0, 10))
const comentario = ref('')

async function cargar() {
  cargando.value = true
  seguimientos.value = await fetchSeguimientos(props.ticketId)
  cargando.value = false
}

watch(() => props.ticketId, cargar, { immediate: true })

async function onSubmit() {
  if (!comentario.value.trim()) return
  guardando.value = true
  try {
    await agregarSeguimiento(props.ticketId, fecha.value, comentario.value.trim())
    comentario.value = ''
    await cargar()
    emit('registrado')
    success('Seguimiento registrado')
  } catch (e) {
    error('No se pudo registrar el seguimiento')
  } finally {
    guardando.value = false
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start gap-2 mb-4">
      <input v-model="fecha" type="date" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" @click="abrirPicker" />
      <textarea
        v-model="comentario"
        rows="1"
        placeholder="¿Qué se hizo/observó?"
        class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring resize-none"
      />
      <button
        :disabled="guardando || !comentario.trim()"
        class="bg-primary hover:bg-primary-hover text-ink-onprimary px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        @click="onSubmit"
      >
        {{ guardando ? 'Guardando...' : 'Agregar' }}
      </button>
    </div>

    <p v-if="cargando" class="text-sm text-gray-400">Cargando historial...</p>
    <p v-else-if="!seguimientos.length" class="text-sm text-gray-400">Sin seguimientos registrados todavía.</p>

    <ul v-else class="space-y-3">
      <li v-for="s in seguimientos" :key="s.id" class="border-l-2 border-gray-200 pl-3">
        <span class="text-xs text-gray-400">{{ formatearFecha(s.fecha) }}</span>
        <p class="text-sm text-gray-700 mt-1">{{ s.comentario }}</p>
      </li>
    </ul>
  </div>
</template>
