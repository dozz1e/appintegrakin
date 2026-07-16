<!-- app/pages/post-venta/[id].vue -->
<script setup lang="ts">
import type { TicketPostVentaConNombres, EstadoTicketPostVenta } from '~/composables/useTicketsPostVenta'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets_post_venta', actions: ['view'] },
})

const route = useRoute()
const { getTicket, actualizarTicket, eliminarTicket } = useTicketsPostVenta()
const { can } = usePermissions()
const { success, error } = useToast()

const ticket = ref<TicketPostVentaConNombres | null>(null)
const cargando = ref(true)
const guardando = ref(false)
const confirmandoEliminar = ref(false)
const eliminando = ref(false)

const estados: EstadoTicketPostVenta[] = [
  'pendiente_ingreso', 'ingreso_equipo', 'probando',
  'espera_repuesto', 'listo_despacho', 'despachado', 'desconocido',
]

async function cargar() {
  ticket.value = await getTicket(route.params.id as string)
  cargando.value = false
}

onMounted(cargar)

async function onCambiarEstado(estado: EstadoTicketPostVenta) {
  if (!ticket.value) return
  guardando.value = true
  try {
    ticket.value = { ...ticket.value, ...(await actualizarTicket(ticket.value.id, { estado })) }
    success('Estado actualizado')
  } catch (e) {
    error('No se pudo actualizar el estado')
  } finally {
    guardando.value = false
  }
}

async function onCambiarFechaDespacho(fecha: string) {
  if (!ticket.value) return
  guardando.value = true
  try {
    ticket.value = { ...ticket.value, ...(await actualizarTicket(ticket.value.id, { fecha_despacho: fecha || null })) }
    success('Fecha de despacho actualizada')
  } catch (e) {
    error('No se pudo actualizar la fecha de despacho')
  } finally {
    guardando.value = false
  }
}

async function onConfirmarEliminar() {
  if (!ticket.value) return
  eliminando.value = true
  try {
    await eliminarTicket(ticket.value.id)
    success('Ticket eliminado')
    await navigateTo('/post-venta')
  } catch (e) {
    error('No se pudo eliminar el ticket. Intenta de nuevo.')
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="p-6">
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <template v-else-if="ticket">
      <SharedPageHeader :titulo="`Guía ${ticket.n_guia}`" volver-a="/post-venta">
        <template #subtitulo>Ingresado el {{ formatearFecha(ticket.fecha_ingreso) }}</template>
        <template #accion>
          <SharedBadge :label="colorTicketPostVenta(ticket.estado).label" :clases="colorTicketPostVenta(ticket.estado).clases" tamano="lg" />
        </template>
      </SharedPageHeader>

      <div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 items-start">
        <SharedCard titulo="Datos del ticket">
          <div class="space-y-3 text-sm">
            <p><span class="text-gray-400">Cliente:</span> {{ ticket.cliente_nombre }}</p>
            <p v-if="ticket.cliente_rut_libre"><span class="text-gray-400">Rut:</span> {{ ticket.cliente_rut_libre }}</p>
            <p v-if="ticket.cliente_celular_libre"><span class="text-gray-400">Celular:</span> {{ ticket.cliente_celular_libre }}</p>
            <p v-if="ticket.cliente_ciudad_libre"><span class="text-gray-400">Ciudad:</span> {{ ticket.cliente_ciudad_libre }}</p>
            <p><span class="text-gray-400">Equipo:</span> {{ ticket.producto_nombre }}</p>
            <p v-if="ticket.descripcion_falla"><span class="text-gray-400">Falla:</span> {{ ticket.descripcion_falla }}</p>
            <p v-if="ticket.fecha_tope"><span class="text-gray-400">Fecha tope:</span> {{ formatearFecha(ticket.fecha_tope) }}</p>
            <p v-if="ticket.observaciones"><span class="text-gray-400">Observaciones:</span> {{ ticket.observaciones }}</p>

            <div v-if="can('tickets_post_venta', 'edit')" class="pt-3 border-t border-gray-100 space-y-3">
              <div>
                <label class="block text-xs font-medium mb-1 text-gray-700">Estado</label>
                <select
                  :value="ticket.estado"
                  :disabled="guardando"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  @change="onCambiarEstado(($event.target as HTMLSelectElement).value as EstadoTicketPostVenta)"
                >
                  <option v-for="e in estados" :key="e" :value="e">{{ colorTicketPostVenta(e).label }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium mb-1 text-gray-700">Fecha de despacho</label>
                <input
                  :value="ticket.fecha_despacho ?? ''"
                  type="date"
                  :disabled="guardando"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  @change="onCambiarFechaDespacho(($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
        </SharedCard>

        <div class="space-y-6">
          <SharedCard titulo="Seguimiento">
            <PostVentaSeguimientoTimeline :ticket-id="ticket.id" />
          </SharedCard>

          <SharedCard v-if="can('tickets_post_venta', 'delete')">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-sm font-semibold text-gray-700">Eliminar ticket</h2>
                <p class="text-xs text-gray-400 mt-1">Esta acción no se puede deshacer.</p>
              </div>
              <button
                type="button"
                class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                @click="confirmandoEliminar = true"
              >
                Eliminar ticket
              </button>
            </div>
          </SharedCard>
        </div>
      </div>

      <SharedConfirmDialog
        :open="confirmandoEliminar"
        titulo="Eliminar ticket"
        :mensaje="`¿Eliminar la guía &quot;${ticket.n_guia}&quot;? Esta acción no se puede deshacer.`"
        :cargando="eliminando"
        @confirmar="onConfirmarEliminar"
        @cancelar="confirmandoEliminar = false"
      />
    </template>
    <p v-else class="text-red-600">Ticket no encontrado</p>
  </div>
</template>
