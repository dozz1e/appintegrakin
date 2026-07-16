<script setup lang="ts">
import type { Ticket } from '~/composables/useTickets'
import type { Tecnico } from '~/composables/useTecnicos'

const props = defineProps<{
  modelValue?: Partial<Ticket>
  clienteIdFijo?: string
  clienteNombreFijo?: string
  cargando?: boolean
}>()
const emit = defineEmits<{ submit: [payload: Partial<Ticket>, archivo: File | null] }>()

const { fetchTecnicos } = useTecnicos()
const { can } = usePermissions()

const form = reactive<Partial<Ticket>>({
  cliente_id: props.modelValue?.cliente_id ?? props.clienteIdFijo ?? '',
  titulo: props.modelValue?.titulo ?? '',
  descripcion: props.modelValue?.descripcion ?? '',
  prioridad: props.modelValue?.prioridad ?? 'media',
  tecnico_id: props.modelValue?.tecnico_id ?? '',
})

const tecnicos = ref<Tecnico[]>([])

onMounted(async () => {
  if (!props.modelValue && can('tickets', 'assign')) {
    tecnicos.value = await fetchTecnicos()
  }
})

const errores = reactive<Record<string, string>>({})

const archivoAdjunto = ref<File | null>(null)
const inputArchivo = ref<HTMLInputElement | null>(null)

function onArchivoSeleccionado(e: Event) {
  archivoAdjunto.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

function quitarAdjunto() {
  archivoAdjunto.value = null
  if (inputArchivo.value) inputArchivo.value.value = ''
}

const validar = () => {
  errores.cliente_id = form.cliente_id ? '' : 'Debes seleccionar un cliente'
  errores.titulo = form.titulo ? '' : 'El título es obligatorio'
  return !Object.values(errores).some(Boolean)
}

const onSubmit = () => {
  if (!validar()) return
  emit('submit', { ...form, tecnico_id: form.tecnico_id || null }, archivoAdjunto.value)
}

const inputClase =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]'
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Cliente *</label>
      <ClientesClienteBuscador v-if="!clienteIdFijo" v-model="form.cliente_id" />
      <input
        v-else
        type="text"
        disabled
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-500"
        :value="clienteNombreFijo ?? clienteIdFijo"
      />
      <p v-if="errores.cliente_id" class="text-sm text-red-600 mt-1">{{ errores.cliente_id }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Título *</label>
      <input v-model="form.titulo" type="text" :class="inputClase" />
      <p v-if="errores.titulo" class="text-sm text-red-600 mt-1">{{ errores.titulo }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Descripción</label>
      <textarea v-model="form.descripcion" rows="4" :class="inputClase"></textarea>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Prioridad</label>
      <select v-model="form.prioridad" :class="inputClase">
        <option value="baja">Baja</option>
        <option value="media">Media</option>
        <option value="alta">Alta</option>
        <option value="urgente">Urgente</option>
      </select>
    </div>

    <div v-if="!modelValue && tecnicos.length">
      <label class="block text-sm font-medium mb-1 text-gray-700">Técnico asignado</label>
      <select v-model="form.tecnico_id" :class="inputClase">
        <option value="">Sin asignar</option>
        <option v-for="t in tecnicos" :key="t.id" :value="t.id">{{ t.nombre }}</option>
      </select>
    </div>

    <div v-if="!modelValue">
      <label class="block text-sm font-medium mb-1 text-gray-700">Imagen (opcional)</label>
      <button
        type="button"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-[#1075B5] hover:border-[#1075B5] transition-colors flex items-center gap-2"
        @click="inputArchivo?.click()"
      >
        <Icon name="mdi:paperclip" class="w-4 h-4" />
        Adjuntar imagen
      </button>
      <input ref="inputArchivo" type="file" accept="image/*" class="hidden" @change="onArchivoSeleccionado" />
      <div v-if="archivoAdjunto" class="flex items-center gap-1 text-xs text-gray-500 mt-1">
        <Icon name="mdi:image-outline" class="w-4 h-4 shrink-0" />
        <span class="truncate">{{ archivoAdjunto.name }}</span>
        <button type="button" class="text-gray-400 hover:text-danger" @click="quitarAdjunto">
          <Icon name="mdi:close" class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <button
      type="submit"
      :disabled="cargando"
      class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {{ cargando ? 'Guardando...' : 'Guardar ticket' }}
    </button>
  </form>
</template>
