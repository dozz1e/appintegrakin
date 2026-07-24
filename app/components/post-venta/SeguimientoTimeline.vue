<!-- app/components/post-venta/SeguimientoTimeline.vue -->
<script setup lang="ts">
import type { TicketPostVentaSeguimiento } from '~/composables/useTicketsPostVenta'

const props = defineProps<{ ticketId: string }>()
const emit = defineEmits<{ registrado: [] }>()
const { fetchSeguimientos, agregarSeguimiento, editarSeguimiento, eliminarSeguimiento } = useTicketsPostVenta()
const { success, error } = useToast()
const { can } = usePermissions()

const seguimientos = ref<TicketPostVentaSeguimiento[]>([])
const cargando = ref(true)
const guardando = ref(false)

const fecha = ref(new Date().toISOString().slice(0, 10))
const comentario = ref('')

const editandoId = ref<string | null>(null)
const fechaEdit = ref('')
const comentarioEdit = ref('')
const guardandoEdit = ref(false)

const eliminandoId = ref<string | null>(null)
const confirmandoEliminarId = ref<string | null>(null)

async function cargar() {
  cargando.value = true
  seguimientos.value = await fetchSeguimientos(props.ticketId)
  cargando.value = false
}

watch(() => props.ticketId, cargar, { immediate: true })

async function onSubmit() {
  if (!comentario.value.trim()) return
  guardando.value = true
  try {
    await agregarSeguimiento(props.ticketId, fecha.value, comentario.value.trim())
    comentario.value = ''
    await cargar()
    emit('registrado')
    success('Seguimiento registrado')
  } catch (e) {
    error('No se pudo registrar el seguimiento')
  } finally {
    guardando.value = false
  }
}

function iniciarEdicion(s: TicketPostVentaSeguimiento) {
  editandoId.value = s.id
  fechaEdit.value = s.fecha
  comentarioEdit.value = s.comentario
}

function cancelarEdicion() {
  editandoId.value = null
}

async function onGuardarEdicion(id: string) {
  if (!comentarioEdit.value.trim()) return
  guardandoEdit.value = true
  try {
    await editarSeguimiento(id, fechaEdit.value, comentarioEdit.value.trim())
    editandoId.value = null
    await cargar()
    success('Seguimiento actualizado')
  } catch (e) {
    error('No se pudo actualizar el seguimiento')
  } finally {
    guardandoEdit.value = false
  }
}

async function onConfirmarEliminar() {
  if (!confirmandoEliminarId.value) return
  eliminandoId.value = confirmandoEliminarId.value
  try {
    await eliminarSeguimiento(confirmandoEliminarId.value)
    await cargar()
    success('Seguimiento eliminado')
  } catch (e) {
    error('No se pudo eliminar el seguimiento')
  } finally {
    eliminandoId.value = null
    confirmandoEliminarId.value = null
  }
}

function formatearFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start gap-2 mb-4">
      <input v-model="fecha" type="date" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <textarea
        v-model="comentario"
        rows="1"
        placeholder="¿Qué se hizo/observó?"
        class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring resize-none"
      />
      <button
        :disabled="guardando || !comentario.trim()"
        class="bg-primary hover:bg-primary-hover text-ink-onprimary px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        @click="onSubmit"
      >
        {{ guardando ? 'Guardando...' : 'Agregar' }}
      </button>
    </div>

    <p v-if="cargando" class="text-sm text-gray-400">Cargando historial...</p>
    <p v-else-if="!seguimientos.length" class="text-sm text-gray-400">Sin seguimientos registrados todavía.</p>

    <ul v-else class="space-y-3">
      <li v-for="s in seguimientos" :key="s.id" class="border-l-2 border-gray-200 pl-3">
        <template v-if="editandoId === s.id">
          <div class="flex flex-wrap items-start gap-2">
            <input v-model="fechaEdit" type="date" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <textarea
              v-model="comentarioEdit"
              rows="1"
              class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring resize-none"
            />
          </div>
          <div class="flex gap-2 mt-2">
            <button
              :disabled="guardandoEdit || !comentarioEdit.trim()"
              class="bg-primary hover:bg-primary-hover text-ink-onprimary px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              @click="onGuardarEdicion(s.id)"
            >
              {{ guardandoEdit ? 'Guardando...' : 'Guardar' }}
            </button>
            <button
              class="border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              @click="cancelarEdicion"
            >
              Cancelar
            </button>
          </div>
        </template>
        <template v-else>
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-xs text-gray-400">{{ formatearFecha(s.fecha) }}</span>
              <p class="text-sm text-gray-700 mt-1">{{ s.comentario }}</p>
            </div>
            <div v-if="can('tickets_post_venta', 'edit')" class="flex gap-1 shrink-0">
              <button
                class="text-gray-400 hover:text-primary p-1"
                title="Editar"
                @click="iniciarEdicion(s)"
              >
                <Icon name="mdi:pencil-outline" class="w-4 h-4" />
              </button>
              <button
                class="text-gray-400 hover:text-red-600 p-1"
                title="Eliminar"
                @click="confirmandoEliminarId = s.id"
              >
                <Icon name="mdi:trash-can-outline" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </template>
      </li>
    </ul>

    <SharedConfirmDialog
      :open="!!confirmandoEliminarId"
      titulo="Eliminar seguimiento"
      mensaje="¿Eliminar este seguimiento? Esta acción no se puede deshacer."
      :cargando="!!eliminandoId"
      @confirmar="onConfirmarEliminar"
      @cancelar="confirmandoEliminarId = null"
    />
  </div>
</template>
