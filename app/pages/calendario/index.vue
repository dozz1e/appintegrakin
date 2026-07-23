<!-- app/pages/calendario/index.vue -->
<script setup lang="ts">
import type { EventoCalendario } from '~/composables/useEventosCalendario'

// Sin definePageMeta/permiso: calendario de oficina abierto a cualquier
// usuario logueado, a pedido explícito ("todos pueden verlo").

const { fetchEventos, crearEvento, actualizarEvento, eliminarEvento } = useEventosCalendario()
const { success, error } = useToast()

const eventos = ref<EventoCalendario[]>([])
const cargando = ref(true)
const guardando = ref(false)
const modalAbierto = ref(false)
const eventoEditando = ref<EventoCalendario | null>(null)
const fechaSeleccionada = ref<string | null>(null)
const aEliminar = ref<EventoCalendario | null>(null)
const eliminando = ref(false)

function diaLocal(fechaIso: string): string {
  const d = new Date(fechaIso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

async function cargar() {
  cargando.value = true
  eventos.value = await fetchEventos()
  cargando.value = false
}

onMounted(cargar)

const eventosFiltrados = computed(() => {
  if (fechaSeleccionada.value) {
    return eventos.value.filter((e) => diaLocal(e.fecha_hora) === fechaSeleccionada.value)
  }
  const hoy = diaLocal(new Date().toISOString())
  return eventos.value.filter((e) => diaLocal(e.fecha_hora) >= hoy)
})

function abrirNuevo() {
  eventoEditando.value = null
  modalAbierto.value = true
}

function abrirEditar(e: EventoCalendario) {
  eventoEditando.value = e
  modalAbierto.value = true
}

async function onSubmit(payload: Record<string, unknown>) {
  guardando.value = true
  try {
    if (eventoEditando.value) {
      await actualizarEvento(eventoEditando.value.id, payload)
      success('Evento actualizado')
    } else {
      await crearEvento(payload as any)
      success('Evento agregado')
    }
    modalAbierto.value = false
    await cargar()
  } catch (e) {
    error('No se pudo guardar el evento. Intenta de nuevo.')
  } finally {
    guardando.value = false
  }
}

async function onConfirmarEliminar() {
  if (!aEliminar.value) return
  eliminando.value = true
  try {
    await eliminarEvento(aEliminar.value.id)
    eventos.value = eventos.value.filter((e) => e.id !== aEliminar.value?.id)
    aEliminar.value = null
    success('Evento eliminado')
  } catch (e) {
    error('No se pudo eliminar el evento')
  } finally {
    eliminando.value = false
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Calendario">
      <template #accion>
        <button
          class="bg-primary hover:bg-primary/90 text-ink-onprimary px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          @click="abrirNuevo"
        >
          + Nuevo evento
        </button>
      </template>
    </SharedPageHeader>

    <div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
      <CalendarioMes
        :eventos="eventos"
        :fecha-seleccionada="fechaSeleccionada"
        @update:fecha-seleccionada="fechaSeleccionada = $event"
      />

      <div>
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm font-medium text-ink">
            {{ fechaSeleccionada ? 'Eventos del día' : 'Próximos eventos' }}
          </p>
          <button v-if="fechaSeleccionada" class="text-sm text-primary hover:underline" @click="fechaSeleccionada = null">
            Ver todos
          </button>
        </div>

        <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>
        <p v-else-if="!eventosFiltrados.length" class="text-ink-muted text-sm">Sin eventos para mostrar.</p>

        <ul v-else class="space-y-2">
          <li v-for="e in eventosFiltrados" :key="e.id" class="border border-border rounded-xl bg-surface p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-ink">{{ e.titulo }}</p>
                <p class="text-xs text-ink-muted">{{ formatearFecha(e.fecha_hora) }} · agregado por {{ e.creador_nombre }}</p>
                <p v-if="e.descripcion" class="text-sm text-ink-secondary mt-1">{{ e.descripcion }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button class="text-xs text-primary hover:underline" @click="abrirEditar(e)">Editar</button>
                <button class="text-ink-muted hover:text-danger-text transition-colors p-1" title="Eliminar" @click="aEliminar = e">
                  <Icon name="mdi:trash-can-outline" class="w-4 h-4" />
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <SharedModal
      :open="modalAbierto"
      :titulo="eventoEditando ? 'Editar evento' : 'Nuevo evento'"
      @cerrar="modalAbierto = false"
    >
      <CalendarioEventoForm :model-value="eventoEditando ?? undefined" :cargando="guardando" @submit="onSubmit" />
    </SharedModal>

    <SharedConfirmDialog
      :open="!!aEliminar"
      titulo="Eliminar evento"
      mensaje="¿Eliminar este evento? Esta acción no se puede deshacer."
      :cargando="eliminando"
      @confirmar="onConfirmarEliminar"
      @cancelar="aEliminar = null"
    />
  </div>
</template>
