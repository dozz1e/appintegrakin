<script setup lang="ts">
import type { Producto } from '~/composables/useProductos'

const props = defineProps<{ modelValue?: Partial<Producto>; cargando?: boolean; mostrarEstado?: boolean }>()
const emit = defineEmits<{ submit: [payload: Partial<Producto>] }>()

const form = reactive<Partial<Producto>>({
  nombre: props.modelValue?.nombre ?? '',
  sku: props.modelValue?.sku ?? '',
  categoria: props.modelValue?.categoria ?? '',
  estado: props.modelValue?.estado ?? 'activo',
})

const activo = computed({
  get: () => form.estado !== 'inactivo',
  set: (val: boolean) => {
    form.estado = val ? 'activo' : 'inactivo'
  },
})

const errores = reactive<Record<string, string>>({})

const validar = () => {
  errores.nombre = form.nombre ? '' : 'El nombre es obligatorio'
  errores.sku = form.sku ? '' : 'El SKU es obligatorio'
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
      <label class="block text-sm font-medium mb-1 text-gray-700">Nombre *</label>
      <input
        v-model="form.nombre"
        type="text"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
      <p v-if="errores.nombre" class="text-sm text-red-600 mt-1">{{ errores.nombre }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">SKU *</label>
      <input
        v-model="form.sku"
        type="text"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
      <p v-if="errores.sku" class="text-sm text-red-600 mt-1">{{ errores.sku }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Categoría</label>
      <input
        v-model="form.categoria"
        type="text"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
    </div>

    <div v-if="mostrarEstado" class="flex items-center gap-2">
      <input v-model="activo" type="checkbox" class="w-4 h-4 accent-[#1075B5]" />
      <label class="text-sm text-gray-700">Activo</label>
    </div>

    <button
      type="submit"
      :disabled="cargando"
      class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {{ cargando ? 'Guardando...' : 'Guardar producto' }}
    </button>
  </form>
</template>
