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
const vista = ref<'dia' | 'semana' | 'mes'>('mes')

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

const proximoEvento = computed(() => {
  if (fechaSeleccionada.value) return null
  return eventosFiltrados.value[0] ?? null
})

const listaSecundaria = computed(() => {
  if (!proximoEvento.value) return eventosFiltrados.value
  return eventosFiltrados.value.filter((e) => e.id !== proximoEvento.value?.id)
})

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

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

function onEliminarDesdeModal() {
  if (!eventoEditando.value) return
  aEliminar.value = eventoEditando.value
  modalAbierto.value = false
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
        <div class="flex items-center gap-3">
          <div class="flex items-center bg-surface-2 rounded-lg p-0.5">
            <button
              v-for="opcion in [{ v: 'dia', l: 'Día' }, { v: 'semana', l: 'Semana' }, { v: 'mes', l: 'Mes' }]"
              :key="opcion.v"
              type="button"
              class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              :class="vista === opcion.v ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'"
              @click="vista = opcion.v as typeof vista"
            >
              {{ opcion.l }}
            </button>
          </div>
          <button
            class="bg-primary hover:bg-primary/90 text-ink-onprimary px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            @click="abrirNuevo"
          >
            + Nuevo evento
          </button>
        </div>
      </template>
    </SharedPageHeader>

    <div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
      <CalendarioMes
        v-if="vista === 'mes'"
        :eventos="eventos"
        :fecha-seleccionada="fechaSeleccionada"
        @update:fecha-seleccionada="fechaSeleccionada = $event"
      />
      <CalendarioSemana
        v-else
        :eventos="eventos"
        :fecha-seleccionada="fechaSeleccionada"
        :modo="vista"
        @update:fecha-seleccionada="fechaSeleccionada = $event"
        @editar-evento="abrirEditar"
      />

      <div class="space-y-5">
        <p v-if="cargando" class="text-ink-muted text-sm">Cargando...</p>

        <template v-else>
          <div v-if="proximoEvento" class="bg-surface border border-border rounded-2xl shadow-sm p-5">
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs font-semibold text-ink-muted uppercase tracking-wide">Próximo evento</p>
              <button class="text-ink-muted hover:text-primary transition-colors p-1" title="Editar" @click="abrirEditar(proximoEvento)">
                <Icon name="mdi:pencil-outline" class="w-4 h-4" />
              </button>
            </div>
            <div class="flex items-start gap-3">
              <div class="w-11 h-11 shrink-0 rounded-xl bg-primary-subtle text-primary-ink flex items-center justify-center">
                <Icon name="mdi:calendar-clock-outline" class="w-5 h-5" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-ink truncate">{{ proximoEvento.titulo }}</p>
                <p class="text-xs text-ink-muted mt-0.5">{{ formatearFecha(proximoEvento.fecha_hora) }}</p>
              </div>
            </div>
            <p v-if="proximoEvento.descripcion" class="text-sm text-ink-secondary mt-3 leading-relaxed">
              {{ proximoEvento.descripcion }}
            </p>
            <div class="flex items-center gap-2 mt-4 pt-3 border-t border-border">
              <span class="w-5 h-5 rounded-full bg-primary-subtle text-primary-ink text-[10px] font-semibold flex items-center justify-center">
                {{ iniciales(proximoEvento.creador_nombre) }}
              </span>
              <span class="text-xs text-ink-muted">Agregado por {{ proximoEvento.creador_nombre }}</span>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm font-medium text-ink">
                {{ fechaSeleccionada ? 'Eventos del día' : 'Próximos eventos' }}
              </p>
              <button v-if="fechaSeleccionada" class="text-sm text-primary hover:underline" @click="fechaSeleccionada = null">
                Ver todos
              </button>
            </div>

            <p v-if="!listaSecundaria.length" class="text-ink-muted text-sm">Sin eventos para mostrar.</p>

            <ul v-else class="space-y-2">
              <li
                v-for="e in listaSecundaria"
                :key="e.id"
                class="group border border-border rounded-xl bg-surface p-4 hover:shadow-sm hover:border-border-strong transition-all"
              >
                <div class="flex items-start gap-3">
                  <div class="w-9 h-9 shrink-0 rounded-full bg-primary-subtle text-primary-ink text-xs font-semibold flex items-center justify-center">
                    {{ iniciales(e.creador_nombre) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-2">
                      <p class="text-sm font-medium text-ink truncate">{{ e.titulo }}</p>
                      <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="text-ink-muted hover:text-primary transition-colors p-1" title="Editar" @click="abrirEditar(e)">
                          <Icon name="mdi:pencil-outline" class="w-4 h-4" />
                        </button>
                        <button class="text-ink-muted hover:text-danger-text transition-colors p-1" title="Eliminar" @click="aEliminar = e">
                          <Icon name="mdi:trash-can-outline" class="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p class="text-xs text-ink-muted mt-0.5">{{ formatearFecha(e.fecha_hora) }} · {{ e.creador_nombre }}</p>
                    <p v-if="e.descripcion" class="text-sm text-ink-secondary mt-1.5 line-clamp-2">{{ e.descripcion }}</p>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </template>
      </div>
    </div>

    <SharedModal
      :open="modalAbierto"
      :titulo="eventoEditando ? 'Editar evento' : 'Nuevo evento'"
      @cerrar="modalAbierto = false"
    >
      <CalendarioEventoForm
        :model-value="eventoEditando ?? undefined"
        :cargando="guardando"
        @submit="onSubmit"
        @eliminar="onEliminarDesdeModal"
      />
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
