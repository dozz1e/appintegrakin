<script setup lang="ts">
import type { ClienteInteraccion } from '~/composables/useClienteInteracciones'

const props = defineProps<{ clienteId: string }>()
const emit = defineEmits<{ registrada: [] }>()
const { fetchInteracciones, agregarInteraccion, actualizarInteraccion, eliminarInteraccion } = useClienteInteracciones()
const { subirImagen } = useEntidadImagenes()
const { success, error } = useToast()

const interacciones = ref<ClienteInteraccion[]>([])
const cargando = ref(true)
const guardando = ref(false)
const aEliminar = ref<ClienteInteraccion | null>(null)
const eliminando = ref(false)

const idEditando = ref<string | null>(null)
const canalEditado = ref<ClienteInteraccion['canal']>('correo')
const notaEditada = ref('')
const guardandoEdicion = ref(false)

const canal = ref<ClienteInteraccion['canal']>('correo')
const nota = ref('')
const archivosAdjuntos = ref<File[]>([])
const inputArchivo = ref<HTMLInputElement | null>(null)
const modalNuevaAbierto = ref(false)

const iconoCanal: Record<string, string> = {
  whatsapp: 'mdi:whatsapp',
  instagram: 'mdi:instagram',
  facebook: 'mdi:facebook',
  llamada: 'mdi:phone-outline',
  web: 'mdi:web',
  correo: 'mdi:email-outline',
}

async function cargar() {
  cargando.value = true
  interacciones.value = await fetchInteracciones(props.clienteId)
  cargando.value = false
}

watch(() => props.clienteId, cargar, { immediate: true })

function onArchivoSeleccionado(e: Event) {
  archivosAdjuntos.value.push(...((e.target as HTMLInputElement).files ?? []))
  if (inputArchivo.value) inputArchivo.value.value = ''
}

function quitarAdjunto(idx: number) {
  archivosAdjuntos.value.splice(idx, 1)
}

async function onSubmit() {
  if (!nota.value.trim()) return
  guardando.value = true
  try {
    const creada = await agregarInteraccion(props.clienteId, canal.value, nota.value.trim())
    if (archivosAdjuntos.value.length) {
      try {
        for (const archivo of archivosAdjuntos.value) await subirImagen('cliente_interaccion', creada.id, archivo)
      } catch (e) {
        error('Interacción registrada, pero no se pudieron subir todos los archivos')
      }
    }
    nota.value = ''
    archivosAdjuntos.value = []
    modalNuevaAbierto.value = false
    await cargar()
    emit('registrada')
    success('Interacción registrada')
  } catch (e) {
    error('No se pudo registrar la interacción')
  } finally {
    guardando.value = false
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function onEditar(i: ClienteInteraccion) {
  idEditando.value = i.id
  canalEditado.value = i.canal
  notaEditada.value = i.nota
}

function onCancelarEdicion() {
  idEditando.value = null
}

async function onGuardarEdicion(i: ClienteInteraccion) {
  if (!notaEditada.value.trim()) return
  guardandoEdicion.value = true
  try {
    const actualizada = await actualizarInteraccion(i.id, canalEditado.value, notaEditada.value.trim())
    const idx = interacciones.value.findIndex((x) => x.id === i.id)
    if (idx !== -1) interacciones.value[idx] = actualizada
    idEditando.value = null
    success('Interacción actualizada')
  } catch (e) {
    error('No se pudo actualizar la interacción')
  } finally {
    guardandoEdicion.value = false
  }
}

async function onConfirmarEliminar() {
  if (!aEliminar.value) return
  eliminando.value = true
  try {
    await eliminarInteraccion(aEliminar.value.id)
    interacciones.value = interacciones.value.filter((i) => i.id !== aEliminar.value?.id)
    aEliminar.value = null
    success('Interacción eliminada')
  } catch (e) {
    error('No se pudo eliminar la interacción')
  } finally {
    eliminando.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <p class="text-base font-semibold text-gray-700">Historial de interacciones</p>
      <button
        type="button"
        title="Nueva interacción"
        class="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-ink-onprimary hover:bg-primary-hover transition-colors duration-150"
        @click="modalNuevaAbierto = true"
      >
        <Icon name="mdi:plus" class="w-5 h-5" />
      </button>
    </div>

    <p v-if="cargando" class="text-sm text-gray-400">Cargando historial...</p>
    <p v-else-if="!interacciones.length" class="text-sm text-gray-400">Sin interacciones registradas todavía.</p>

    <ul v-else class="space-y-3">
      <li
        v-for="i in interacciones"
        :key="i.id"
        class="flex gap-3 border-l-2 pl-3"
        :class="colorCanal(i.canal).clases.split(' ')[1]?.replace('text-', 'border-')"
      >
        <Icon :name="iconoCanal[i.canal]" class="w-5 h-5 mt-0.5 flex-shrink-0" :class="colorCanal(i.canal).clases.split(' ')[1]" />
        <div v-if="idEditando === i.id" class="flex-1 flex flex-wrap gap-2">
          <select
            v-model="canalEditado"
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="llamada">Llamada</option>
            <option value="web">Web</option>
            <option value="correo">Correo</option>
          </select>
          <input
            v-model="notaEditada"
            type="text"
            class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
            @keyup.enter="onGuardarEdicion(i)"
          />
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="guardandoEdicion || !notaEditada.trim()"
              class="bg-primary hover:bg-primary-hover text-ink-onprimary px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              @click="onGuardarEdicion(i)"
            >
              Guardar
            </button>
            <button
              type="button"
              class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              @click="onCancelarEdicion"
            >
              Cancelar
            </button>
          </div>
          <SharedGaleriaImagenes entidad-tipo="cliente_interaccion" :entidad-id="i.id" class="w-full mt-1" />
        </div>
        <div v-else class="flex-1">
          <div class="flex items-center gap-2">
            <SharedBadge :label="colorCanal(i.canal).label" :clases="colorCanal(i.canal).clases" />
            <span class="text-sm text-gray-400">{{ formatearFecha(i.created_at) }}</span>
          </div>
          <SharedTextoExpandible :texto="i.nota" class="text-sm text-gray-700 mt-1" />
          <SharedGaleriaImagenes entidad-tipo="cliente_interaccion" :entidad-id="i.id" :permitir-agregar="false" class="mt-2" />
        </div>
        <div v-if="idEditando !== i.id" class="flex gap-3 shrink-0">
          <button
            type="button"
            class="text-gray-300 hover:text-primary transition-colors p-1"
            title="Editar"
            @click="onEditar(i)"
          >
            <Icon name="mdi:pencil-outline" class="w-5 h-5" />
          </button>
          <button
            type="button"
            class="text-gray-300 hover:text-danger transition-colors p-1"
            title="Eliminar"
            @click="aEliminar = i"
          >
            <Icon name="mdi:trash-can-outline" class="w-5 h-5" />
          </button>
        </div>
      </li>
    </ul>

    <SharedConfirmDialog
      :open="!!aEliminar"
      titulo="Eliminar interacción"
      mensaje="¿Eliminar esta interacción? Esta acción no se puede deshacer."
      :cargando="eliminando"
      @confirmar="onConfirmarEliminar"
      @cancelar="aEliminar = null"
    />

    <SharedModal :open="modalNuevaAbierto" titulo="Nueva interacción" @cerrar="modalNuevaAbierto = false">
      <div class="space-y-2">
        <select
          v-model="canal"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        >
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="llamada">Llamada</option>
          <option value="web">Web</option>
          <option value="correo">Correo</option>
        </select>
        <textarea
          v-model="nota"
          rows="3"
          placeholder="¿Qué se conversó?"
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
            :disabled="guardando || !nota.trim()"
            class="flex-1 bg-primary hover:bg-primary-hover text-ink-onprimary px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            @click="onSubmit"
          >
            {{ guardando ? 'Guardando...' : 'Agregar' }}
          </button>
        </div>
      </div>
    </SharedModal>
  </div>
</template>
