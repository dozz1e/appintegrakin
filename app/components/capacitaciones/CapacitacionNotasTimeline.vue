<script setup lang="ts">
import type { CapacitacionNota } from '~/composables/useCapacitacionNotas'

const props = defineProps<{ citaId: string }>()

const { fetchNotas, agregarNota, actualizarNota, eliminarNota } = useCapacitacionNotas()
const { subirImagen } = useEntidadImagenes()
const { success, error } = useToast()

const notas = ref<CapacitacionNota[]>([])
const cargando = ref(true)
const guardando = ref(false)
const aEliminar = ref<CapacitacionNota | null>(null)
const eliminando = ref(false)

const idEditando = ref<string | null>(null)
const notaEditada = ref('')
const guardandoEdicion = ref(false)

const notaNueva = ref('')
const archivosAdjuntos = ref<File[]>([])
const inputArchivo = ref<HTMLInputElement | null>(null)

async function cargar() {
  cargando.value = true
  notas.value = await fetchNotas(props.citaId)
  cargando.value = false
}

watch(() => props.citaId, cargar, { immediate: true })

function onArchivoSeleccionado(e: Event) {
  archivosAdjuntos.value.push(...((e.target as HTMLInputElement).files ?? []))
  if (inputArchivo.value) inputArchivo.value.value = ''
}

function quitarAdjunto(idx: number) {
  archivosAdjuntos.value.splice(idx, 1)
}

async function onAgregar() {
  if (!notaNueva.value.trim()) return
  guardando.value = true
  try {
    const creada = await agregarNota(props.citaId, notaNueva.value.trim())
    if (archivosAdjuntos.value.length) {
      try {
        for (const archivo of archivosAdjuntos.value) await subirImagen('capacitacion_nota', creada.id, archivo)
      } catch (e) {
        error('Anotación guardada, pero no se pudieron subir todos los archivos')
      }
    }
    notas.value = [creada, ...notas.value]
    notaNueva.value = ''
    archivosAdjuntos.value = []
  } catch (e) {
    error('No se pudo guardar la anotación')
  } finally {
    guardando.value = false
  }
}

function onEditar(n: CapacitacionNota) {
  idEditando.value = n.id
  notaEditada.value = n.nota
}

function onCancelarEdicion() {
  idEditando.value = null
}

async function onGuardarEdicion(n: CapacitacionNota) {
  if (!notaEditada.value.trim()) return
  guardandoEdicion.value = true
  try {
    const actualizada = await actualizarNota(n.id, notaEditada.value.trim())
    const idx = notas.value.findIndex((x) => x.id === n.id)
    if (idx !== -1) notas.value[idx] = actualizada
    idEditando.value = null
    success('Anotación actualizada')
  } catch (e) {
    error('No se pudo actualizar la anotación')
  } finally {
    guardandoEdicion.value = false
  }
}

async function onConfirmarEliminar() {
  if (!aEliminar.value) return
  eliminando.value = true
  try {
    await eliminarNota(aEliminar.value.id)
    notas.value = notas.value.filter((n) => n.id !== aEliminar.value?.id)
    aEliminar.value = null
    success('Anotación eliminada')
  } catch (e) {
    error('No se pudo eliminar la anotación')
  } finally {
    eliminando.value = false
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}
</script>

<template>
  <div>
    <p v-if="cargando" class="text-sm text-gray-400">Cargando anotaciones...</p>
    <p v-else-if="!notas.length" class="text-sm text-gray-400">Sin anotaciones todavía.</p>

    <ul v-else class="space-y-3 mb-3">
      <li v-for="n in notas" :key="n.id" class="border-l-2 border-gray-200 pl-3">
        <div v-if="idEditando === n.id" class="space-y-2">
          <textarea
            v-model="notaEditada"
            rows="2"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring resize-none"
          />
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="guardandoEdicion || !notaEditada.trim()"
              class="bg-primary hover:bg-primary-hover text-ink-onprimary px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              @click="onGuardarEdicion(n)"
            >
              Guardar
            </button>
            <button
              type="button"
              class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              @click="onCancelarEdicion"
            >
              Cancelar
            </button>
          </div>
        </div>
        <div v-else class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <span class="text-xs text-gray-400">{{ formatearFecha(n.created_at) }}</span>
            <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ n.nota }}</p>
            <SharedGaleriaImagenes entidad-tipo="capacitacion_nota" :entidad-id="n.id" :permitir-agregar="false" class="mt-2" />
          </div>
          <div class="flex gap-2 shrink-0">
            <button type="button" class="text-gray-300 hover:text-primary transition-colors p-1" title="Editar" @click="onEditar(n)">
              <Icon name="mdi:pencil-outline" class="w-4 h-4" />
            </button>
            <button type="button" class="text-gray-300 hover:text-danger transition-colors p-1" title="Eliminar" @click="aEliminar = n">
              <Icon name="mdi:trash-can-outline" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </li>
    </ul>

    <div class="space-y-2 border-t border-gray-100 pt-3">
      <textarea
        v-model="notaNueva"
        rows="2"
        placeholder="Deja una anotación sobre esta capacitación..."
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring resize-none"
      />
      <div v-if="archivosAdjuntos.length" class="space-y-1">
        <span v-for="(archivo, idx) in archivosAdjuntos" :key="idx" class="flex items-center gap-1 text-xs text-gray-500">
          <Icon name="mdi:paperclip" class="w-4 h-4 shrink-0" />
          <span class="truncate">{{ archivo.name }}</span>
          <button type="button" class="text-gray-400 hover:text-danger shrink-0" @click="quitarAdjunto(idx)">
            <Icon name="mdi:close" class="w-3.5 h-3.5" />
          </button>
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          title="Adjuntar archivo"
          class="flex items-center gap-1.5 border-2 border-primary bg-primary-subtle text-primary rounded-lg px-3 py-2 text-sm font-medium hover:bg-primary hover:text-ink-onprimary transition-colors shrink-0"
          @click="inputArchivo?.click()"
        >
          <Icon name="mdi:paperclip" class="w-4 h-4" />
          Adjuntar
        </button>
        <input ref="inputArchivo" type="file" multiple class="hidden" @change="onArchivoSeleccionado" />
        <button
          type="button"
          :disabled="guardando || !notaNueva.trim()"
          class="flex-1 bg-primary hover:bg-primary-hover text-ink-onprimary px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          @click="onAgregar"
        >
          {{ guardando ? 'Guardando...' : 'Agregar anotación' }}
        </button>
      </div>
    </div>

    <SharedConfirmDialog
      :open="!!aEliminar"
      titulo="Eliminar anotación"
      mensaje="¿Eliminar esta anotación? Esta acción no se puede deshacer."
      :cargando="eliminando"
      @confirmar="onConfirmarEliminar"
      @cancelar="aEliminar = null"
    />
  </div>
</template>
