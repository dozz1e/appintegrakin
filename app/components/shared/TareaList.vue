<script setup lang="ts">
import type { Tarea } from '~/composables/useTareas'

const props = defineProps<{
  entidadTipo: Tarea['entidad_tipo']
  entidadId: string
}>()

const { fetchTareasPorEntidad, crearTarea, marcarCompletada, actualizarTarea, eliminarTarea } = useTareas()
const { success, error } = useToast()

const tareas = ref<Tarea[]>([])
const cargando = ref(true)
const guardando = ref(false)
const aEliminar = ref<Tarea | null>(null)
const eliminando = ref(false)

const idEditando = ref<string | null>(null)
const tituloEditado = ref('')
const fechaEditada = ref('')
const horaEditada = ref('')
const guardandoEdicion = ref(false)

const titulo = ref('')
const fechaVencimiento = ref('')
const horaVencimiento = ref('')

async function cargar() {
  cargando.value = true
  tareas.value = await fetchTareasPorEntidad(props.entidadTipo, props.entidadId)
  cargando.value = false
}

onMounted(cargar)

// Si se omite la hora, la tarea vence al final del día elegido (23:59) en
// vez de a medianoche — evita que una tarea "para hoy" se marque vencida
// apenas empieza el día.
function construirFechaVencimiento(fecha: string, hora: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const [horas, minutos] = hora ? hora.split(':').map(Number) : [23, 59]
  return new Date(anio, mes - 1, dia, horas, minutos, 0).toISOString()
}

async function onSubmit() {
  if (!titulo.value.trim()) return
  guardando.value = true
  try {
    await crearTarea(
      props.entidadTipo,
      props.entidadId,
      titulo.value.trim(),
      fechaVencimiento.value ? construirFechaVencimiento(fechaVencimiento.value, horaVencimiento.value) : null
    )
    titulo.value = ''
    fechaVencimiento.value = ''
    horaVencimiento.value = ''
    await cargar()
    success('Tarea creada')
  } catch (e) {
    error('No se pudo crear la tarea')
  } finally {
    guardando.value = false
  }
}

async function onToggle(tarea: Tarea) {
  try {
    await marcarCompletada(tarea.id, !tarea.completada)
    await cargar()
  } catch (e) {
    error('No se pudo actualizar la tarea')
  }
}

function aFechaInput(fechaIso: string | null): string {
  if (!fechaIso) return ''
  const d = new Date(fechaIso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function aHoraInput(fechaIso: string | null): string {
  if (!fechaIso) return ''
  const d = new Date(fechaIso)
  const esDefault = d.getHours() === 23 && d.getMinutes() === 59
  if (esDefault) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function onEditar(tarea: Tarea) {
  idEditando.value = tarea.id
  tituloEditado.value = tarea.titulo
  fechaEditada.value = aFechaInput(tarea.fecha_vencimiento)
  horaEditada.value = aHoraInput(tarea.fecha_vencimiento)
}

function onCancelarEdicion() {
  idEditando.value = null
}

async function onGuardarEdicion(tarea: Tarea) {
  if (!tituloEditado.value.trim()) return
  guardandoEdicion.value = true
  try {
    const actualizada = await actualizarTarea(
      tarea.id,
      tituloEditado.value.trim(),
      fechaEditada.value ? construirFechaVencimiento(fechaEditada.value, horaEditada.value) : null
    )
    const idx = tareas.value.findIndex((t) => t.id === tarea.id)
    if (idx !== -1) tareas.value[idx] = actualizada
    idEditando.value = null
    success('Tarea actualizada')
  } catch (e) {
    error('No se pudo actualizar la tarea')
  } finally {
    guardandoEdicion.value = false
  }
}

async function onConfirmarEliminar() {
  if (!aEliminar.value) return
  eliminando.value = true
  try {
    await eliminarTarea(aEliminar.value.id)
    tareas.value = tareas.value.filter((t) => t.id !== aEliminar.value?.id)
    aEliminar.value = null
    success('Tarea eliminada')
  } catch (e) {
    error('No se pudo eliminar la tarea')
  } finally {
    eliminando.value = false
  }
}

function esVencida(tarea: Tarea) {
  return !tarea.completada && tarea.fecha_vencimiento && new Date(tarea.fecha_vencimiento) < new Date()
}

function formatearFecha(fecha: string) {
  const d = new Date(fecha)
  const esDefault = d.getHours() === 23 && d.getMinutes() === 59
  const base = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
  if (esDefault) return base
  return `${base}, ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}
</script>

<template>
  <SharedCard>
    <div class="flex items-center gap-2 mb-4">
      <h2 class="text-sm font-semibold text-ink">Tareas y recordatorios</h2>
      <span
        v-if="tareas.length"
        class="text-xs font-medium text-ink-muted bg-surface-2 rounded-full px-2 py-0.5"
      >
        {{ tareas.length }}
      </span>
    </div>

    <div class="mb-4 space-y-2">
      <input
        v-model="titulo"
        type="text"
        placeholder="Ej: Llamar en 3 días"
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        @keyup.enter="onSubmit"
      />
      <div class="flex flex-wrap gap-2">
        <input
          v-model="fechaVencimiento"
          type="date"
          class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
          @click="abrirPicker"
        />
        <input
          v-model="horaVencimiento"
          type="time"
          class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
          @click="abrirPicker"
        />
        <button
          :disabled="guardando || !titulo.trim()"
          class="w-full sm:w-auto bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          @click="onSubmit"
        >
          Agregar
        </button>
      </div>
    </div>

    <p v-if="cargando" class="text-sm text-gray-400">Cargando tareas...</p>
    <p v-else-if="!tareas.length" class="text-sm text-gray-400">Sin tareas pendientes.</p>

    <ul v-else class="space-y-2">
      <li
        v-for="t in tareas"
        :key="t.id"
        class="flex items-start gap-3 py-2.5 px-3 rounded-xl"
        :class="esVencida(t) ? 'bg-red-50' : 'bg-gray-50'"
      >
        <button
          v-if="idEditando !== t.id"
          type="button"
          class="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors"
          :class="t.completada ? 'bg-[#1075B5] border-[#1075B5]' : 'border-gray-300 hover:border-[#1075B5]'"
          @click="onToggle(t)"
        >
          <Icon v-if="t.completada" name="mdi:check-bold" class="w-3.5 h-3.5 text-white" />
        </button>
        <div v-if="idEditando === t.id" class="flex-1 space-y-2">
          <input
            v-model="tituloEditado"
            type="text"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
            @keyup.enter="onGuardarEdicion(t)"
          />
          <div class="flex flex-wrap gap-2">
            <input
              v-model="fechaEditada"
              type="date"
              class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
              @click="abrirPicker"
            />
            <input
              v-model="horaEditada"
              type="time"
              class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
              @click="abrirPicker"
            />
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="guardandoEdicion || !tituloEditado.trim()"
              class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              @click="onGuardarEdicion(t)"
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
        </div>
        <template v-else>
          <div class="flex-1 min-w-0">
            <SharedTextoExpandible
              :texto="t.titulo"
              class="text-sm"
              :class="t.completada ? 'line-through text-gray-400' : 'text-gray-700'"
            />
            <span v-if="t.fecha_vencimiento" class="block text-sm mt-1" :class="esVencida(t) ? 'text-red-600 font-medium' : 'text-gray-400'">
              {{ formatearFecha(t.fecha_vencimiento) }}
            </span>
          </div>
        </template>
        <div v-if="idEditando !== t.id" class="flex gap-3 shrink-0">
          <button
            type="button"
            class="text-gray-300 hover:text-[#1075B5] transition-colors p-1"
            title="Editar"
            @click="onEditar(t)"
          >
            <Icon name="mdi:pencil-outline" class="w-5 h-5" />
          </button>
          <button
            type="button"
            class="text-gray-300 hover:text-red-600 transition-colors p-1"
            title="Eliminar"
            @click="aEliminar = t"
          >
            <Icon name="mdi:trash-can-outline" class="w-5 h-5" />
          </button>
        </div>
      </li>
    </ul>

    <SharedConfirmDialog
      :open="!!aEliminar"
      titulo="Eliminar tarea"
      mensaje="¿Eliminar esta tarea? Esta acción no se puede deshacer."
      :cargando="eliminando"
      @confirmar="onConfirmarEliminar"
      @cancelar="aEliminar = null"
    />
  </SharedCard>
</template>