<script setup lang="ts">
import type { Tarea } from '~/composables/useTareas'

const props = defineProps<{
  entidadTipo: Tarea['entidad_tipo']
  entidadId: string
}>()

const { fetchTareasPorEntidad, crearTarea, marcarCompletada } = useTareas()
const { success, error } = useToast()

const tareas = ref<Tarea[]>([])
const cargando = ref(true)
const guardando = ref(false)

const titulo = ref('')
const fechaVencimiento = ref('')

async function cargar() {
  cargando.value = true
  tareas.value = await fetchTareasPorEntidad(props.entidadTipo, props.entidadId)
  cargando.value = false
}

onMounted(cargar)

async function onSubmit() {
  if (!titulo.value.trim()) return
  guardando.value = true
  try {
    await crearTarea(
      props.entidadTipo,
      props.entidadId,
      titulo.value.trim(),
      fechaVencimiento.value || null
    )
    titulo.value = ''
    fechaVencimiento.value = ''
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

function esVencida(tarea: Tarea) {
  return !tarea.completada && tarea.fecha_vencimiento && new Date(tarea.fecha_vencimiento) < new Date()
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <SharedCard titulo="Tareas y recordatorios">
    <div class="flex gap-2 mb-4">
      <input
        v-model="titulo"
        type="text"
        placeholder="Ej: Llamar en 3 días"
        class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        @keyup.enter="onSubmit"
      />
      <input
        v-model="fechaVencimiento"
        type="date"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
      />
      <button
        :disabled="guardando || !titulo.trim()"
        class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        @click="onSubmit"
      >
        Agregar
      </button>
    </div>

    <p v-if="cargando" class="text-sm text-gray-400">Cargando tareas...</p>
    <p v-else-if="!tareas.length" class="text-sm text-gray-400">Sin tareas pendientes.</p>

    <ul v-else class="space-y-2">
      <li
        v-for="t in tareas"
        :key="t.id"
        class="flex items-center gap-3 p-2 rounded-lg"
        :class="esVencida(t) ? 'bg-red-50' : 'bg-gray-50'"
      >
        <input
          type="checkbox"
          :checked="t.completada"
          class="w-4 h-4 accent-[#1075B5]"
          @change="onToggle(t)"
        />
        <span class="flex-1 text-sm" :class="t.completada ? 'line-through text-gray-400' : 'text-gray-700'">
          {{ t.titulo }}
        </span>
        <span v-if="t.fecha_vencimiento" class="text-xs" :class="esVencida(t) ? 'text-red-600 font-medium' : 'text-gray-400'">
          {{ formatearFecha(t.fecha_vencimiento) }}
        </span>
      </li>
    </ul>
  </SharedCard>
</template>