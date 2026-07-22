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

const EXTENSIONES_IMAGEN = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif']

function esImagen(url: string) {
  const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase()
  return !!ext && EXTENSIONES_IMAGEN.includes(ext)
}

function extension(url: string) {
  return url.split('.').pop()?.split('?')[0]?.toUpperCase() ?? ''
}

function abrirArchivo(idx: number) {
  const img = imagenes.value[idx]
  if (esImagen(img.url)) previewIndex.value = idx
  else window.open(img.url, '_blank')
}

function nombreArchivo(url: string) {
  const segmento = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? 'archivo')
  return segmento.replace(/^\d+-/, '')
}

async function descargar(img: EntidadImagen) {
  try {
    const res = await fetch(img.url)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo(img.url)
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    error('No se pudo descargar el archivo')
  }
}

async function onArchivoSeleccionado(e: Event) {
  const archivos = Array.from((e.target as HTMLInputElement).files ?? [])
  if (!archivos.length) return
  subiendo.value = true
  try {
    for (const archivo of archivos) {
      const img = await subirImagen(props.entidadTipo, props.entidadId, archivo)
      imagenes.value.push(img)
    }
  } catch (e) {
    error('No se pudo subir el archivo')
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
    error('No se pudo eliminar el archivo')
  } finally {
    eliminando.value = false
  }
}
</script>

<template>
  <div>
    <p v-if="cargando" class="text-xs text-gray-400">Cargando archivos...</p>
    <div v-else class="flex flex-wrap gap-2">
      <div v-for="(img, idx) in imagenes" :key="img.id" class="relative group">
        <button type="button" @click="abrirArchivo(idx)">
          <img v-if="esImagen(img.url)" :src="img.url" class="w-16 h-16 object-cover rounded-lg border border-gray-200" />
          <div
            v-else
            class="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-0.5 text-gray-500"
          >
            <Icon name="mdi:file-outline" class="w-6 h-6" />
            <span class="text-[10px] font-medium">{{ extension(img.url) }}</span>
          </div>
        </button>
        <button
          type="button"
          class="absolute -bottom-1.5 -right-1.5 bg-white rounded-full border border-gray-200 text-gray-400 hover:text-primary w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title="Descargar archivo"
          @click="descargar(img)"
        >
          <Icon name="mdi:download" class="w-3 h-3" />
        </button>
        <button
          v-if="img.created_by === user?.sub"
          type="button"
          class="absolute -top-1.5 -right-1.5 bg-white rounded-full border border-gray-200 text-gray-400 hover:text-danger w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title="Eliminar archivo"
          @click="aEliminar = img"
        >
          <Icon name="mdi:close" class="w-3 h-3" />
        </button>
      </div>

      <button
        v-if="permitirAgregar"
        type="button"
        :disabled="subiendo"
        title="Agregar archivo"
        class="w-16 h-16 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:text-primary hover:border-primary flex items-center justify-center transition-colors disabled:opacity-50"
        @click="inputArchivo?.click()"
      >
        <Icon :name="subiendo ? 'mdi:loading' : 'mdi:paperclip'" :class="subiendo ? 'animate-spin' : ''" class="w-5 h-5" />
      </button>
      <input v-if="permitirAgregar" ref="inputArchivo" type="file" multiple class="hidden" @change="onArchivoSeleccionado" />
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
          class="absolute top-4 right-14 text-white/70 hover:text-white w-10 h-10 flex items-center justify-center"
          title="Descargar"
          @click.stop="descargar(preview)"
        >
          <Icon name="mdi:download" class="w-6 h-6" />
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
      titulo="Eliminar archivo"
      mensaje="¿Eliminar este archivo? Esta acción no se puede deshacer."
      :cargando="eliminando"
      @confirmar="onConfirmarEliminar"
      @cancelar="aEliminar = null"
    />
  </div>
</template>
