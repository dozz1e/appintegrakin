<script setup lang="ts">
import type { LeadInteraccion } from '~/composables/useLeadInteracciones'

const props = defineProps<{ leadId: string }>()
const { fetchInteracciones, agregarInteraccion, actualizarInteraccion, eliminarInteraccion } = useLeadInteracciones()
const { subirImagen } = useEntidadImagenes()
const { success, error } = useToast()

const interacciones = ref<LeadInteraccion[]>([])
const cargando = ref(true)
const guardando = ref(false)
const aEliminar = ref<LeadInteraccion | null>(null)
const eliminando = ref(false)

const idEditando = ref<string | null>(null)
const canalEditado = ref<'whatsapp' | 'instagram' | 'facebook' | 'llamada' | 'web' | 'correo'>('correo')
const notaEditada = ref('')
const guardandoEdicion = ref(false)

const canal = ref<'whatsapp' | 'instagram' | 'facebook' | 'llamada' | 'web' | 'correo'>('correo')
const nota = ref('')
const archivoAdjunto = ref<File | null>(null)
const inputArchivo = ref<HTMLInputElement | null>(null)

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
  interacciones.value = await fetchInteracciones(props.leadId)
  cargando.value = false
}

onMounted(cargar)

function onArchivoSeleccionado(e: Event) {
  archivoAdjunto.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

function quitarAdjunto() {
  archivoAdjunto.value = null
  if (inputArchivo.value) inputArchivo.value.value = ''
}

async function onSubmit() {
  if (!nota.value.trim()) return
  guardando.value = true
  try {
    const creada = await agregarInteraccion(props.leadId, canal.value, nota.value.trim())
    if (archivoAdjunto.value) {
      try {
        await subirImagen('lead_interaccion', creada.id, archivoAdjunto.value)
      } catch (e) {
        error('Interacción registrada, pero no se pudo subir la imagen')
      }
    }
    nota.value = ''
    quitarAdjunto()
    await cargar()
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

function onEditar(i: LeadInteraccion) {
  idEditando.value = i.id
  canalEditado.value = i.canal
  notaEditada.value = i.nota
}

function onCancelarEdicion() {
  idEditando.value = null
}

async function onGuardarEdicion(i: LeadInteraccion) {
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
  <SharedCard titulo="Historial de interacciones">
    <div class="flex flex-wrap gap-2 mb-4">
      <select
        v-model="canal"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
      >
        <option value="whatsapp">WhatsApp</option>
        <option value="instagram">Instagram</option>
        <option value="facebook">Facebook</option>
        <option value="llamada">Llamada</option>
        <option value="web">Web</option>
        <option value="correo">Correo</option>
      </select>
      <input
        v-model="nota"
        type="text"
        placeholder="¿Qué respondió el cliente?"
        class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        @keyup.enter="onSubmit"
      />
      <button
        type="button"
        title="Adjuntar imagen"
        class="border border-gray-200 rounded-lg px-3 py-2 text-gray-500 hover:text-[#1075B5] hover:border-[#1075B5] transition-colors"
        @click="inputArchivo?.click()"
      >
        <Icon name="mdi:paperclip" class="w-4 h-4" />
      </button>
      <input ref="inputArchivo" type="file" accept="image/*" class="hidden" @change="onArchivoSeleccionado" />
      <button
        :disabled="guardando || !nota.trim()"
        class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        @click="onSubmit"
      >
        {{ guardando ? 'Guardando...' : 'Agregar' }}
      </button>
      <span v-if="archivoAdjunto" class="w-full flex items-center gap-1 text-xs text-gray-500">
        <Icon name="mdi:image-outline" class="w-4 h-4 shrink-0" />
        <span class="truncate">{{ archivoAdjunto.name }}</span>
        <button type="button" class="text-gray-400 hover:text-danger" @click="quitarAdjunto">
          <Icon name="mdi:close" class="w-3.5 h-3.5" />
        </button>
      </span>
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
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
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
            class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
            @keyup.enter="onGuardarEdicion(i)"
          />
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="guardandoEdicion || !notaEditada.trim()"
              class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
          <SharedGaleriaImagenes entidad-tipo="lead_interaccion" :entidad-id="i.id" class="w-full mt-1" />
        </div>
        <div v-else class="flex-1">
          <div class="flex items-center gap-2">
            <SharedBadge :label="colorCanal(i.canal).label" :clases="colorCanal(i.canal).clases" />
            <span class="text-xs text-gray-400">{{ formatearFecha(i.created_at) }}</span>
          </div>
          <SharedTextoExpandible :texto="i.nota" class="text-sm text-gray-700 mt-1" />
          <SharedGaleriaImagenes entidad-tipo="lead_interaccion" :entidad-id="i.id" :permitir-agregar="false" class="mt-2" />
        </div>
        <div v-if="idEditando !== i.id" class="flex gap-3 shrink-0">
          <button
            type="button"
            class="text-gray-300 hover:text-[#1075B5] transition-colors p-1"
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
  </SharedCard>
</template>