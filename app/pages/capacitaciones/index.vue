<!-- app/pages/capacitaciones/index.vue -->
<script setup lang="ts">
import type { CitaCapacitacionConNombres } from '~/composables/useCitasCapacitacion'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'capacitaciones', actions: ['view', 'view_all'] },
})

const { fetchCitas, crearCita, actualizarCita } = useCitasCapacitacion()
const { success, error } = useToast()
const { can } = usePermissions()

const citas = ref<CitaCapacitacionConNombres[]>([])
const cargando = ref(true)
const guardando = ref(false)
const modalAbierto = ref(false)
const citaEditando = ref<CitaCapacitacionConNombres | null>(null)
const filtroDesde = ref('')
const filtroHasta = ref('')
const fechaSeleccionada = ref<string | null>(null)

async function cargar() {
  cargando.value = true
  citas.value = await fetchCitas()
  cargando.value = false
}

onMounted(cargar)

const citasFiltradas = computed(() => {
  if (fechaSeleccionada.value) {
    return citas.value.filter((c) => c.fecha_hora.slice(0, 10) === fechaSeleccionada.value)
  }
  return citas.value.filter((c) => {
    const t = new Date(c.fecha_hora).getTime()
    if (filtroDesde.value && t < new Date(filtroDesde.value).getTime()) return false
    if (filtroHasta.value) {
      const finDia = new Date(filtroHasta.value)
      finDia.setHours(23, 59, 59, 999)
      if (t > finDia.getTime()) return false
    }
    return true
  })
})

function filtrarHoy() {
  fechaSeleccionada.value = null
  const hoy = new Date().toISOString().slice(0, 10)
  filtroDesde.value = hoy
  filtroHasta.value = hoy
}

function filtrarEstaSemana() {
  fechaSeleccionada.value = null
  const ahora = new Date()
  const inicio = new Date(ahora)
  inicio.setDate(ahora.getDate() - ahora.getDay())
  const fin = new Date(inicio)
  fin.setDate(inicio.getDate() + 6)
  filtroDesde.value = inicio.toISOString().slice(0, 10)
  filtroHasta.value = fin.toISOString().slice(0, 10)
}

function onDiaClick(fecha: string | null) {
  fechaSeleccionada.value = fecha
  if (fecha) {
    filtroDesde.value = ''
    filtroHasta.value = ''
  }
}

function abrirNueva() {
  citaEditando.value = null
  modalAbierto.value = true
}

function abrirEditar(c: CitaCapacitacionConNombres) {
  citaEditando.value = c
  modalAbierto.value = true
}

async function onSubmit(payload: Record<string, unknown>) {
  guardando.value = true
  try {
    if (citaEditando.value) {
      await actualizarCita(citaEditando.value.id, payload)
      success('Capacitación actualizada')
    } else {
      await crearCita(payload as any)
      success('Capacitación agendada')
    }
    modalAbierto.value = false
    await cargar()
  } catch (e) {
    error('No se pudo guardar la capacitación. Intenta de nuevo.')
  } finally {
    guardando.value = false
  }
}

async function cambiarEstado(c: CitaCapacitacionConNombres, estado: 'completada' | 'cancelada') {
  try {
    await actualizarCita(c.id, { estado })
    await cargar()
    success(estado === 'completada' ? 'Marcada como completada' : 'Capacitación cancelada')
  } catch (e) {
    error('No se pudo actualizar el estado')
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Capacitaciones">
      <template #accion>
        <button
          v-if="can('capacitaciones', 'create')"
          class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          @click="abrirNueva"
        >
          + Nueva capacitación
        </button>
      </template>
    </SharedPageHeader>

    <div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
      <CapacitacionesCalendarioMes
        :citas="citas"
        :fecha-seleccionada="fechaSeleccionada"
        @update:fecha-seleccionada="onDiaClick"
      />

      <div>
        <div class="flex flex-wrap gap-2 mb-4">
          <input
            v-model="filtroDesde"
            type="date"
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            @change="fechaSeleccionada = null"
          />
          <input
            v-model="filtroHasta"
            type="date"
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            @change="fechaSeleccionada = null"
          />
          <button class="text-sm text-[#1075B5] hover:underline" @click="filtrarHoy">Hoy</button>
          <button class="text-sm text-[#1075B5] hover:underline" @click="filtrarEstaSemana">Esta semana</button>
        </div>

        <p v-if="cargando" class="text-gray-400">Cargando...</p>
        <p v-else-if="!citasFiltradas.length" class="text-gray-400">Sin capacitaciones para el rango elegido.</p>

        <ul v-else class="space-y-2">
          <li
            v-for="c in citasFiltradas"
            :key="c.id"
            class="border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-3"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-800">{{ c.cliente_nombre }} — {{ c.producto_nombre }}</p>
              <p class="text-xs text-gray-400">{{ formatearFecha(c.fecha_hora) }} · {{ c.titulo }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <SharedBadge :label="colorCitaCapacitacion(c.estado).label" :clases="colorCitaCapacitacion(c.estado).clases" />
              <button class="text-xs text-[#1075B5] hover:underline" @click="abrirEditar(c)">Editar</button>
              <button
                v-if="c.estado === 'pendiente'"
                class="text-xs text-green-600 hover:underline"
                @click="cambiarEstado(c, 'completada')"
              >
                Completar
              </button>
              <button
                v-if="c.estado === 'pendiente'"
                class="text-xs text-red-600 hover:underline"
                @click="cambiarEstado(c, 'cancelada')"
              >
                Cancelar
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <SharedModal
      :open="modalAbierto"
      :titulo="citaEditando ? 'Editar capacitación' : 'Nueva capacitación'"
      @cerrar="modalAbierto = false"
    >
      <CapacitacionesCitaForm :model-value="citaEditando ?? undefined" :cargando="guardando" @submit="onSubmit" />
    </SharedModal>
  </div>
</template>
