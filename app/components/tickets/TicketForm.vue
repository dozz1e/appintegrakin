<script setup lang="ts">
import type { Ticket } from '~/composables/useTickets'
import type { Cliente } from '~/composables/useClientes'

const props = defineProps<{
  modelValue?: Partial<Ticket>
  clienteIdFijo?: string
  clienteNombreFijo?: string
  cargando?: boolean
}>()
const emit = defineEmits<{ submit: [payload: Partial<Ticket>] }>()

const { fetchClientes } = useClientes()
const clientes = ref<Cliente[]>([])

onMounted(async () => {
  if (!props.clienteIdFijo) {
    clientes.value = await fetchClientes()
  }
})

const form = reactive<Partial<Ticket>>({
  cliente_id: props.modelValue?.cliente_id ?? props.clienteIdFijo ?? '',
  titulo: props.modelValue?.titulo ?? '',
  descripcion: props.modelValue?.descripcion ?? '',
  prioridad: props.modelValue?.prioridad ?? 'media',
})

const errores = reactive<Record<string, string>>({})

const validar = () => {
  errores.cliente_id = form.cliente_id ? '' : 'Debes seleccionar un cliente'
  errores.titulo = form.titulo ? '' : 'El título es obligatorio'
  return !Object.values(errores).some(Boolean)
}

const onSubmit = () => {
  if (!validar()) return
  emit('submit', { ...form })
}

const inputClase =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]'
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Cliente *</label>
      <select v-if="!clienteIdFijo" v-model="form.cliente_id" :class="inputClase">
        <option value="" disabled>Selecciona un cliente</option>
        <option v-for="c in clientes" :key="c.id" :value="c.id">{{ c.razon_social }}</option>
      </select>
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

    <button
      type="submit"
      :disabled="cargando"
      class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {{ cargando ? 'Guardando...' : 'Guardar ticket' }}
    </button>
  </form>
</template>
