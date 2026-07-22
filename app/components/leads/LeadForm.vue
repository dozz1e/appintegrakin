<script setup lang="ts">
import type { Lead } from '~/composables/useLeads'

const props = defineProps<{ modelValue?: Partial<Lead>; cargando?: boolean }>()
const emit = defineEmits<{ submit: [payload: Partial<Lead>] }>()

const { getCliente } = useClientes()

const form = reactive<Partial<Lead>>({
  nombre: props.modelValue?.nombre ?? '',
  telefono: props.modelValue?.telefono ?? '',
  email: props.modelValue?.email ?? '',
  origen: props.modelValue?.origen ?? 'web',
})

const esCliente = ref(!!props.modelValue?.cliente_id)
const clienteId = ref(props.modelValue?.cliente_id ?? '')

watch(clienteId, async (id) => {
  if (!id) return
  const cliente = await getCliente(id)
  form.nombre = cliente.nombre_contacto || cliente.razon_social
  form.telefono = cliente.telefono
  form.email = cliente.email
})

watch(esCliente, (marcado) => {
  if (!marcado) clienteId.value = ''
})

const errores = reactive<Record<string, string>>({})

const validar = () => {
  errores.nombre = form.nombre ? '' : 'El nombre es obligatorio'
  errores.contacto = form.telefono || form.email ? '' : 'Debe tener al menos teléfono o email'
  errores.cliente = esCliente.value && !clienteId.value ? 'Selecciona un cliente' : ''
  return !Object.values(errores).some(Boolean)
}

const onSubmit = () => {
  if (!validar()) return
  emit('submit', { ...form, cliente_id: esCliente.value ? clienteId.value : null })
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div class="flex items-center gap-2">
      <input id="es-cliente" v-model="esCliente" type="checkbox" class="rounded border-gray-300 text-[#1075B5] focus:ring-[#1075B5]/30" />
      <label for="es-cliente" class="text-sm font-medium text-gray-700">Ya es cliente</label>
    </div>

    <div v-if="esCliente">
      <label class="block text-sm font-medium mb-1 text-gray-700">Buscar cliente *</label>
      <ClientesClienteBuscador v-model="clienteId" />
      <p v-if="errores.cliente" class="text-sm text-red-600 mt-1">{{ errores.cliente }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Nombre *</label>
      <input
        v-model="form.nombre"
        type="text"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
      <p v-if="errores.nombre" class="text-sm text-red-600 mt-1">{{ errores.nombre }}</p>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Teléfono</label>
        <input
          v-model="form.telefono"
          type="text"
          class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
        />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Email</label>
        <input
          v-model="form.email"
          type="email"
          class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
        />
      </div>
    </div>
    <p v-if="errores.contacto" class="text-sm text-red-600">{{ errores.contacto }}</p>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Origen</label>
      <select
        v-model="form.origen"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      >
        <option value="web">Web</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="instagram">Instagram</option>
        <option value="facebook">Facebook</option>
        <option value="referido">Referido</option>
        <option value="otro">Otro</option>
      </select>
    </div>

    <button
      type="submit"
      :disabled="cargando"
      class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {{ cargando ? 'Guardando...' : 'Guardar lead' }}
    </button>
  </form>
</template>
