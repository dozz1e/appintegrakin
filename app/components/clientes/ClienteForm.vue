<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'

const props = defineProps<{ modelValue?: Partial<Cliente>; cargando?: boolean }>()
const emit = defineEmits<{ submit: [payload: Partial<Cliente>, archivoImagen?: File | null] }>()

const form = reactive<Partial<Cliente>>({
  rut: props.modelValue?.rut ?? '',
  razon_social: props.modelValue?.razon_social ?? '',
  nombre_contacto: props.modelValue?.nombre_contacto ?? '',
  telefono: props.modelValue?.telefono ?? '',
  email: props.modelValue?.email ?? '',
  direccion: props.modelValue?.direccion ?? '',
})

const errores = reactive<Record<string, string>>({})

const TAMANO_MAXIMO_BYTES = 3 * 1024 * 1024
const inputImagen = ref<HTMLInputElement | null>(null)
const previewImagen = ref<string | null>(props.modelValue?.imagen_url ?? null)
const archivoImagen = ref<File | null>(null)
const imagenQuitada = ref(false)
const errorImagen = ref('')

function onSeleccionarImagen(e: Event) {
  const archivo = (e.target as HTMLInputElement).files?.[0]
  if (!archivo) return

  if (!archivo.type.startsWith('image/')) {
    errorImagen.value = 'El archivo debe ser una imagen'
    return
  }
  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    errorImagen.value = 'La imagen no puede pesar más de 3 MB'
    return
  }

  errorImagen.value = ''
  imagenQuitada.value = false
  archivoImagen.value = archivo
  previewImagen.value = URL.createObjectURL(archivo)
}

function onQuitarImagen() {
  archivoImagen.value = null
  previewImagen.value = null
  errorImagen.value = ''
  imagenQuitada.value = true
  if (inputImagen.value) inputImagen.value.value = ''
}

const validar = () => {
  errores.razon_social = form.razon_social ? '' : 'La razón social es obligatoria'
  errores.email = form.email && !/^\S+@\S+\.\S+$/.test(form.email) ? 'Email inválido' : ''
  return !Object.values(errores).some(Boolean)
}

const onSubmit = () => {
  if (!validar()) return
  const archivo = archivoImagen.value ?? (imagenQuitada.value ? null : undefined)
  emit('submit', { ...form }, archivo)
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Foto</label>
      <div class="flex items-center gap-3">
        <label
          class="w-16 h-16 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer shrink-0 hover:bg-gray-100 transition-colors"
        >
          <img v-if="previewImagen" :src="previewImagen" alt="Foto del cliente" class="w-full h-full object-cover" />
          <Icon v-else name="mdi:image-outline" class="w-6 h-6 text-gray-300" />
          <input ref="inputImagen" type="file" accept="image/*" class="hidden" @change="onSeleccionarImagen" />
        </label>
        <button
          v-if="previewImagen"
          type="button"
          class="text-sm text-red-600 hover:underline font-medium"
          @click="onQuitarImagen"
        >
          Quitar foto
        </button>
      </div>
      <p v-if="errorImagen" class="text-sm text-red-600 mt-1">{{ errorImagen }}</p>
    </div>

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

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Dirección</label>
      <input
        v-model="form.direccion"
        type="text"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
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
