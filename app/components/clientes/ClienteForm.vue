<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'

const props = defineProps<{ modelValue?: Partial<Cliente>; cargando?: boolean }>()
const emit = defineEmits<{ submit: [payload: Partial<Cliente>] }>()

const form = reactive<Partial<Cliente>>({
  rut: props.modelValue?.rut ?? '',
  razon_social: props.modelValue?.razon_social ?? '',
  nombre_contacto: props.modelValue?.nombre_contacto ?? '',
  telefono: props.modelValue?.telefono ?? '',
  email: props.modelValue?.email ?? '',
})

const errores = reactive<Record<string, string>>({})

const validar = () => {
  errores.razon_social = form.razon_social ? '' : 'La razón social es obligatoria'
  errores.email = form.email && !/^\S+@\S+\.\S+$/.test(form.email) ? 'Email inválido' : ''
  return !Object.values(errores).some(Boolean)
}

const onSubmit = () => {
  if (!validar()) return
  emit('submit', { ...form })
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Razón social *</label>
      <input
        v-model="form.razon_social"
        type="text"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
      <p v-if="errores.razon_social" class="text-sm text-red-600 mt-1">{{ errores.razon_social }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">RUT</label>
      <input
        v-model="form.rut"
        type="text"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Nombre de contacto</label>
      <input
        v-model="form.nombre_contacto"
        type="text"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
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
        <p v-if="errores.email" class="text-sm text-red-600 mt-1">{{ errores.email }}</p>
      </div>
    </div>

    <button
      type="submit"
      :disabled="cargando"
      class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {{ cargando ? 'Guardando...' : 'Guardar cliente' }}
    </button>
  </form>
</template>
