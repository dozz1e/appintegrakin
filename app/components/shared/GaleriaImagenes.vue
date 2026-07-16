<script setup lang="ts">
import type { EntidadImagen, EntidadImagenTipo } from '~/composables/useEntidadImagenes'

const props = withDefaults(
  defineProps<{ entidadTipo: EntidadImagenTipo; entidadId: string; permitirAgregar?: boolean }>(),
  { permitirAgregar: true }
)

const { fetchImagenes, subirImagen, eliminarImagen } = useEntidadImagenes()
const user = useSupabaseUser()
const { error } = useToast()

const imagenes = ref<EntidadImagen[]>([])
const cargando = ref(true)
const subiendo = ref(false)
const inputArchivo = ref<HTMLInputElement | null>(null)
const aEliminar = ref<EntidadImagen | null>(null)
const eliminando = ref(false)
const previewIndex = ref<number | null>(null)
const preview = computed(() => (previewIndex.value !== null ? imagenes.value[previewIndex.value] : null))

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

function siguiente() {
  if (previewIndex.value === null) return
  previewIndex.value = (previewIndex.value + 1) % imagenes.value.length
}
function anterior() {
  if (previewIndex.value === null) return
  previewIndex.value = (previewIndex.value - 1 + imagenes.value.length) % imagenes.value.length
}
function onTeclaPreview(e: KeyboardEvent) {
  if (previewIndex.value === null) return
  if (e.key === 'ArrowRight') siguiente()
  if (e.key === 'ArrowLeft') anterior()
  if (e.key === 'Escape') previewIndex.value = null
}

onMounted(() => window.addEventListener('keydown', onTeclaPreview))
onUnmounted(() => window.removeEventListener('keydown', onTeclaPreview))

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
      <div v-for="(img, idx) in imagenes" :key="img.id" class="relative group">
        <button type="button" @click="previewIndex = idx">
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
        v-if="permitirAgregar"
        type="button"
        :disabled="subiendo"
        title="Agregar imagen"
        class="w-16 h-16 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:text-primary hover:border-primary flex items-center justify-center transition-colors disabled:opacity-50"
        @click="inputArchivo?.click()"
      >
        <Icon :name="subiendo ? 'mdi:loading' : 'mdi:image-plus'" :class="subiendo ? 'animate-spin' : ''" class="w-5 h-5" />
      </button>
      <input v-if="permitirAgregar" ref="inputArchivo" type="file" accept="image/*" class="hidden" @change="onArchivoSeleccionado" />
    </div>

    <Teleport to="body">
      <div
        v-if="preview"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        @click="previewIndex = null"
      >
        <button
          v-if="imagenes.length > 1"
          type="button"
          class="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white w-10 h-10 flex items-center justify-center"
          title="Anterior"
          @click.stop="anterior"
        >
          <Icon name="mdi:chevron-left" class="w-8 h-8" />
        </button>
        <img :src="preview.url" class="max-w-full max-h-full rounded-lg" @click.stop />
        <button
          v-if="imagenes.length > 1"
          type="button"
          class="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white w-10 h-10 flex items-center justify-center"
          title="Siguiente"
          @click.stop="siguiente"
        >
          <Icon name="mdi:chevron-right" class="w-8 h-8" />
        </button>
        <button
          type="button"
          class="absolute top-4 right-4 text-white/70 hover:text-white w-10 h-10 flex items-center justify-center"
          title="Cerrar"
          @click.stop="previewIndex = null"
        >
          <Icon name="mdi:close" class="w-6 h-6" />
        </button>
        <span v-if="imagenes.length > 1" class="absolute bottom-4 text-white/70 text-sm">
          {{ previewIndex! + 1 }} / {{ imagenes.length }}
        </span>
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
