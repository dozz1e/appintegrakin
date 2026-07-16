<script setup lang="ts">
import type { EntidadImagen, EntidadImagenTipo } from '~/composables/useEntidadImagenes'

const props = defineProps<{ entidadTipo: EntidadImagenTipo; entidadId: string }>()

const { fetchImagenes, subirImagen, eliminarImagen } = useEntidadImagenes()
const user = useSupabaseUser()
const { error } = useToast()

const imagenes = ref<EntidadImagen[]>([])
const cargando = ref(true)
const subiendo = ref(false)
const inputArchivo = ref<HTMLInputElement | null>(null)
const aEliminar = ref<EntidadImagen | null>(null)
const eliminando = ref(false)
const preview = ref<string | null>(null)

async function cargar() {
  cargando.value = true
  imagenes.value = await fetchImagenes(props.entidadTipo, props.entidadId)
  cargando.value = false
}

watch(() => props.entidadId, cargar, { immediate: true })

async function onArchivoSeleccionado(e: Event) {
  const archivo = (e.target as HTMLInputElement).files?.[0]
  if (!archivo) return
  subiendo.value = true
  try {
    const img = await subirImagen(props.entidadTipo, props.entidadId, archivo)
    imagenes.value.push(img)
  } catch (e) {
    error('No se pudo subir la imagen')
  } finally {
    subiendo.value = false
    if (inputArchivo.value) inputArchivo.value.value = ''
  }
}

async function onConfirmarEliminar() {
  if (!aEliminar.value) return
  eliminando.value = true
  try {
    await eliminarImagen(aEliminar.value.id)
    imagenes.value = imagenes.value.filter((i) => i.id !== aEliminar.value?.id)
    aEliminar.value = null
  } catch (e) {
    error('No se pudo eliminar la imagen')
  } finally {
    eliminando.value = false
  }
}
</script>

<template>
  <div>
    <p v-if="cargando" class="text-xs text-gray-400">Cargando imágenes...</p>
    <div v-else class="flex flex-wrap gap-2">
      <div v-for="img in imagenes" :key="img.id" class="relative group">
        <button type="button" @click="preview = img.url">
          <img :src="img.url" class="w-16 h-16 object-cover rounded-lg border border-gray-200" />
        </button>
        <button
          v-if="img.created_by === user?.sub"
          type="button"
          class="absolute -top-1.5 -right-1.5 bg-white rounded-full border border-gray-200 text-gray-400 hover:text-danger w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title="Eliminar imagen"
          @click="aEliminar = img"
        >
          <Icon name="mdi:close" class="w-3 h-3" />
        </button>
      </div>

      <button
        type="button"
        :disabled="subiendo"
        title="Agregar imagen"
        class="w-16 h-16 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:text-primary hover:border-primary flex items-center justify-center transition-colors disabled:opacity-50"
        @click="inputArchivo?.click()"
      >
        <Icon :name="subiendo ? 'mdi:loading' : 'mdi:image-plus'" :class="subiendo ? 'animate-spin' : ''" class="w-5 h-5" />
      </button>
      <input ref="inputArchivo" type="file" accept="image/*" class="hidden" @change="onArchivoSeleccionado" />
    </div>

    <Teleport to="body">
      <div
        v-if="preview"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        @click="preview = null"
      >
        <img :src="preview" class="max-w-full max-h-full rounded-lg" />
      </div>
    </Teleport>

    <SharedConfirmDialog
      :open="!!aEliminar"
      titulo="Eliminar imagen"
      mensaje="¿Eliminar esta imagen? Esta acción no se puede deshacer."
      :cargando="eliminando"
      @confirmar="onConfirmarEliminar"
      @cancelar="aEliminar = null"
    />
  </div>
</template>
