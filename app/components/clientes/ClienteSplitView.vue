<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'
import type { Ticket } from '~/composables/useTickets'
import type { Usuario } from '~/composables/useUsuarios'

const props = defineProps<{ clientes: Cliente[]; usuarios: Usuario[]; clienteIdInicial?: string }>()
const emit = defineEmits<{ eliminar: [cliente: Cliente]; actualizar: [cliente: Cliente] }>()

const { fetchTicketsPorCliente, fetchConteoTicketsCliente, createTicket } = useTickets()
const { fetchUltimasInteracciones } = useClienteInteracciones()
const { asignarCliente, updateCliente, subirImagenCliente } = useClientes()
const { agregarProductoATicket } = useTicketProductos()
const { subirImagen } = useEntidadImagenes()
const { can } = usePermissions()
const { success, error } = useToast()

const asignando = ref(false)
const modalEditarAbierto = ref(false)
const guardandoEdicion = ref(false)
const modalNuevoTicketAbierto = ref(false)
const guardandoTicket = ref(false)

async function recargarTickets() {
  if (!seleccionado.value) return
  if (puedeVerResumenTickets.value) {
    conteoTickets.value = await fetchConteoTicketsCliente(seleccionado.value.id)
  }
  if (puedeVerTickets.value) {
    ticketsSeleccionado.value = await fetchTicketsPorCliente(seleccionado.value.id)
  }
}

async function onSubmitTicket(payload: Partial<Ticket>, archivo: File | null, productosIds: string[]) {
  guardandoTicket.value = true
  try {
    const ticket = await createTicket(payload)
    if (archivo) {
      try {
        await subirImagen('ticket', ticket.id, archivo)
      } catch (e) {
        error('Ticket creado, pero no se pudo subir la imagen')
      }
    }
    if (productosIds.length) {
      try {
        await Promise.all(productosIds.map((id) => agregarProductoATicket(ticket.id, id)))
      } catch (e) {
        error('Ticket creado, pero no se pudieron asociar los productos')
      }
    }
    modalNuevoTicketAbierto.value = false
    await recargarTickets()
    success('Ticket creado correctamente')
  } catch (e) {
    error('No se pudo crear el ticket. Intenta de nuevo.')
  } finally {
    guardandoTicket.value = false
  }
}

async function onAsignarVendedor(vendedorId: string) {
  if (!seleccionado.value) return
  asignando.value = true
  try {
    const actualizado = await asignarCliente(seleccionado.value.id, vendedorId || null)
    emit('actualizar', actualizado)
    success('Vendedor asignado')
  } catch (e) {
    error('No se pudo asignar el vendedor. Intenta de nuevo.')
  } finally {
    asignando.value = false
  }
}

async function onSubmitEdicion(payload: Record<string, unknown>, archivoImagen?: File | null) {
  if (!seleccionado.value) return
  guardandoEdicion.value = true
  try {
    let payloadFinal = payload
    if (archivoImagen) {
      const imagen_url = await subirImagenCliente(seleccionado.value.id, archivoImagen)
      payloadFinal = { ...payload, imagen_url }
    } else if (archivoImagen === null) {
      payloadFinal = { ...payload, imagen_url: null }
    }

    const actualizado = await updateCliente(seleccionado.value.id, payloadFinal, seleccionado.value.version)
    emit('actualizar', actualizado)
    success('Cliente actualizado')
    modalEditarAbierto.value = false
  } catch (e: any) {
    if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este cliente mientras lo tenías abierto. Vuelve a abrirlo para ver los datos actuales.')
      modalEditarAbierto.value = false
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  } finally {
    guardandoEdicion.value = false
  }
}

const busqueda = ref('')
const filtroVendedor = ref('')
const filtroFechaDesde = ref('')
const filtroFechaHasta = ref('')
const filtroAntiguedad = ref('')
const seleccionadoId = ref<string | null>(props.clienteIdInicial ?? null)
const listaClientes = ref<HTMLElement | null>(null)
const ticketsSeleccionado = ref<Ticket[]>([])
const conteoTickets = ref({ total: 0, abiertos: 0, resueltos: 0 })
const tabActiva = ref<'interacciones' | 'tickets' | 'ventas'>('interacciones')
const ultimasInteracciones = ref<Record<string, string>>({})

const puedeVerTickets = computed(() => can('tickets', 'view') || can('tickets', 'view_all'))
const puedeVerResumenTickets = computed(() => can('clientes', 'view_tickets_resumen'))
const puedeVerVentas = computed(() => can('ventas', 'view') || can('ventas', 'view_all'))

const opcionesAntiguedad = [
  { value: '', label: 'Última interacción: cualquiera' },
  { value: '7', label: 'Sin contacto hace 7+ días' },
  { value: '15', label: 'Sin contacto hace 15+ días' },
  { value: '30', label: 'Sin contacto hace 30+ días' },
  { value: '60', label: 'Sin contacto hace 60+ días' },
  { value: 'nunca', label: 'Nunca contactados' },
]

onMounted(async () => {
  ultimasInteracciones.value = await fetchUltimasInteracciones()
})

watch(
  () => props.clienteIdInicial,
  (id) => {
    if (!id) return
    seleccionadoId.value = id
    // llega desde el buscador general - limpiar filtros del listado para
    // asegurar que el cliente esté en clientesFiltrados y sea visible
    busqueda.value = ''
    filtroVendedor.value = ''
    filtroAntiguedad.value = ''
    filtroFechaDesde.value = ''
    filtroFechaHasta.value = ''
    nextTick(() => {
      listaClientes.value?.querySelector(`[data-cliente-id="${id}"]`)?.scrollIntoView({ block: 'center' })
    })
  },
  { immediate: true }
)

const clientesFiltrados = computed(() => {
  const q = normalizarTexto(busqueda.value.trim())
  return props.clientes.filter((c) => {
    if (
      q &&
      !normalizarTexto(c.razon_social).includes(q) &&
      !normalizarTexto(c.nombre_contacto ?? '').includes(q) &&
      !normalizarTexto(c.rut ?? '').includes(q) &&
      !normalizarTexto(c.telefono ?? '').includes(q) &&
      !normalizarTexto(c.email ?? '').includes(q)
    )
      return false
    if (filtroVendedor.value === 'sin_asignar' && c.owner_id !== null) return false
    if (filtroVendedor.value && filtroVendedor.value !== 'sin_asignar' && c.owner_id !== filtroVendedor.value) return false

    const ultima = ultimasInteracciones.value[c.id]

    if (filtroAntiguedad.value === 'nunca' && ultima) return false
    if (filtroAntiguedad.value && filtroAntiguedad.value !== 'nunca') {
      const limite = Date.now() - Number(filtroAntiguedad.value) * 24 * 60 * 60 * 1000
      if (ultima && new Date(ultima).getTime() > limite) return false
    }

    if (filtroFechaDesde.value || filtroFechaHasta.value) {
      if (!ultima) return false
      const t = new Date(ultima).getTime()
      if (filtroFechaDesde.value && t < new Date(filtroFechaDesde.value).getTime()) return false
      if (filtroFechaHasta.value) {
        const finDia = new Date(filtroFechaHasta.value)
        finDia.setHours(23, 59, 59, 999)
        if (t > finDia.getTime()) return false
      }
    }

    return true
  })
})

function formatearFechaCorta(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}

const seleccionado = computed(() => props.clientes.find((c) => c.id === seleccionadoId.value) ?? null)

const totalTickets = computed(() => conteoTickets.value.total)
const ticketsAbiertos = computed(() => conteoTickets.value.abiertos)
const ticketsResueltos = computed(() => conteoTickets.value.resueltos)

watch(seleccionadoId, async (id) => {
  tabActiva.value = 'interacciones'
  ticketsSeleccionado.value = []
  conteoTickets.value = { total: 0, abiertos: 0, resueltos: 0 }
  if (!id) return
  if (puedeVerResumenTickets.value) {
    conteoTickets.value = await fetchConteoTicketsCliente(id)
  }
  if (puedeVerTickets.value) {
    ticketsSeleccionado.value = await fetchTicketsPorCliente(id)
  }
})

function seleccionar(c: Cliente) {
  seleccionadoId.value = c.id
}

async function onInteraccionRegistrada() {
  ultimasInteracciones.value = await fetchUltimasInteracciones()
}
</script>

<template>
  <!-- La barra lateral del menú + lista (18rem) + panel de tareas (28rem) no
       dejan espacio para el detalle hasta pantallas bien anchas (medido:
       recién a partir de ~1700px cabían las 3 columnas sin aplastar el
       detalle) - el panel de tareas se separa así solo entra como tercera
       columna desde ese ancho; por debajo queda debajo, apilado. -->
  <div class="flex flex-col min-[1700px]:flex-row gap-4 items-start">
  <div class="flex flex-col min-[1200px]:flex-row gap-4 items-start flex-1 min-w-0 w-full">
    <div
      class="w-full min-[1200px]:w-72 shrink-0 bg-white border border-gray-100 rounded-2xl shadow-sm p-3 max-h-[70vh] overflow-y-auto"
      :class="seleccionadoId ? 'hidden min-[1200px]:block' : ''"
    >
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por nombre, contacto o RUT..."
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
      <select
        v-if="can('clientes', 'view_all')"
        v-model="filtroVendedor"
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
      >
        <option value="">Todos los vendedores</option>
        <option value="sin_asignar">Sin asignar</option>
        <option v-for="u in usuarios" :key="u.id" :value="u.id">{{ u.full_name || u.email }}</option>
      </select>
      <select
        v-model="filtroAntiguedad"
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
      >
        <option v-for="o in opcionesAntiguedad" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <div class="flex gap-2 mb-3">
        <input
          v-model="filtroFechaDesde"
          type="date"
          class="w-1/2 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
          @click="abrirPicker"
        />
        <input
          v-model="filtroFechaHasta"
          type="date"
          class="w-1/2 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
          @click="abrirPicker"
        />
      </div>
      <ul ref="listaClientes" class="space-y-1">
        <li
          v-for="c in clientesFiltrados"
          :key="c.id"
          :data-cliente-id="c.id"
          class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors"
          :class="c.id === seleccionadoId ? 'bg-[#EAF4FA]' : 'hover:bg-gray-50'"
          @click="seleccionar(c)"
        >
          <SharedAvatar :nombre="c.razon_social" :imagen-url="c.imagen_url" size="sm" />
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate">{{ c.razon_social }}</p>
            <p v-if="c.nombre_contacto" class="text-xs text-gray-400 truncate">{{ c.nombre_contacto }}</p>
            <p class="text-xs text-gray-400 truncate">
              Últ. interacción: {{ ultimasInteracciones[c.id] ? formatearFechaCorta(ultimasInteracciones[c.id]) : 'Nunca' }}
            </p>
          </div>
        </li>
      </ul>
      <p v-if="!clientesFiltrados.length" class="text-sm text-gray-400 text-center py-4">Sin resultados</p>
    </div>

    <div
      v-if="!seleccionado"
      class="hidden min-[1200px]:block flex-1 min-w-0 bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400"
    >
      Selecciona un cliente de la lista para ver su detalle.
    </div>

    <div v-else class="flex-1 min-w-0 w-full">
      <button
        type="button"
        class="min-[1200px]:hidden flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        @click="seleccionadoId = null"
      >
        <Icon name="mdi:arrow-left" class="w-4 h-4" />
        Volver a la lista
      </button>

      <div class="@container bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <div class="flex flex-col sm:flex-row gap-5 mb-5">
          <SharedAvatar
            :nombre="seleccionado.razon_social"
            :imagen-url="seleccionado.imagen_url"
            size="lg"
            cuadrado
            class="mx-auto sm:mx-0 shrink-0"
          />

          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 class="text-xl font-semibold text-gray-800">{{ seleccionado.razon_social }}</h2>
                <p v-if="seleccionado.nombre_contacto" class="text-sm text-gray-400 mt-0.5">{{ seleccionado.nombre_contacto }}</p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <a
                  v-if="seleccionado.telefono"
                  :href="`tel:${seleccionado.telefono}`"
                  title="Llamar"
                  class="w-9 h-9 flex items-center justify-center rounded-full text-ink-secondary hover:bg-surface-2 hover:text-primary transition-colors duration-150"
                >
                  <Icon name="mdi:phone-outline" class="w-5 h-5" />
                </a>
                <a
                  v-if="seleccionado.email"
                  :href="`mailto:${seleccionado.email}`"
                  title="Enviar email"
                  class="w-9 h-9 flex items-center justify-center rounded-full text-ink-secondary hover:bg-surface-2 hover:text-primary transition-colors duration-150"
                >
                  <Icon name="mdi:email-outline" class="w-5 h-5" />
                </a>
                <button
                  v-if="can('clientes', 'edit')"
                  type="button"
                  title="Editar cliente"
                  class="w-9 h-9 flex items-center justify-center rounded-full text-ink-secondary hover:bg-surface-2 hover:text-primary transition-colors duration-150"
                  @click="modalEditarAbierto = true"
                >
                  <Icon name="mdi:pencil-outline" class="w-5 h-5" />
                </button>
                <button
                  v-if="can('clientes', 'delete')"
                  type="button"
                  title="Eliminar"
                  class="w-9 h-9 flex items-center justify-center rounded-full text-ink-secondary hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
                  @click="emit('eliminar', seleccionado)"
                >
                  <Icon name="mdi:trash-can-outline" class="w-5 h-5" />
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div class="min-w-0">
                <p class="text-xs text-gray-400">RUT</p>
                <p class="text-gray-700 break-words">{{ seleccionado.rut || '—' }}</p>
              </div>
              <div class="min-w-0">
                <p class="text-xs text-gray-400">Teléfono</p>
                <p class="text-gray-700 break-words">{{ seleccionado.telefono || '—' }}</p>
              </div>
              <div class="min-w-0">
                <p class="text-xs text-gray-400">Email</p>
                <p class="text-gray-700 break-words">{{ seleccionado.email || '—' }}</p>
              </div>
              <div class="min-w-0">
                <p class="text-xs text-gray-400">Comuna</p>
                <p class="text-gray-700 break-words">{{ seleccionado.comuna || '—' }}</p>
              </div>
              <div class="col-span-2 min-w-0">
                <p class="text-xs text-gray-400">Dirección</p>
                <p class="text-gray-700 break-words">{{ seleccionado.direccion || '—' }}, {{ seleccionado.ciudad || '—' }}</p>
              </div>
              <div class="col-span-2">
                <p class="text-xs text-gray-400 mb-1">Vendedor asignado</p>
                <select
                  v-if="can('clientes', 'assign')"
                  :value="seleccionado.owner_id ?? ''"
                  :disabled="asignando"
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
                  @change="onAsignarVendedor(($event.target as HTMLSelectElement).value)"
                >
                  <option value="">Sin asignar</option>
                  <option v-for="u in usuarios" :key="u.id" :value="u.id">{{ u.full_name || u.email }}</option>
                </select>
                <p v-else class="text-gray-700">
                  {{ usuarios.find((u) => u.id === seleccionado.owner_id)?.full_name || 'Sin asignar' }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="puedeVerResumenTickets" class="grid grid-cols-3 gap-3 mb-4">
          <div class="bg-gray-50 rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400">Total tickets</p>
            <p class="text-xl font-semibold text-gray-800">{{ totalTickets }}</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400">Abiertos</p>
            <p class="text-xl font-semibold text-gray-800">{{ ticketsAbiertos }}</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400">Resueltos</p>
            <p class="text-xl font-semibold text-gray-800">{{ ticketsResueltos }}</p>
          </div>
        </div>

        <div class="flex gap-2 mb-4 overflow-x-auto">
          <button
            type="button"
            class="shrink-0 rounded-lg px-4 py-2 text-base font-medium transition-colors"
            :class="tabActiva === 'interacciones' ? 'bg-primary text-ink-onprimary' : 'bg-surface-2 text-ink-muted hover:bg-primary-subtle hover:text-primary-ink'"
            @click="tabActiva = 'interacciones'"
          >
            Interacciones
          </button>
          <button
            v-if="puedeVerTickets"
            type="button"
            class="shrink-0 rounded-lg px-4 py-2 text-base font-medium transition-colors"
            :class="tabActiva === 'tickets' ? 'bg-primary text-ink-onprimary' : 'bg-surface-2 text-ink-muted hover:bg-primary-subtle hover:text-primary-ink'"
            @click="tabActiva = 'tickets'"
          >
            Tickets
          </button>
          <button
            v-if="puedeVerVentas"
            type="button"
            class="shrink-0 rounded-lg px-4 py-2 text-base font-medium transition-colors"
            :class="tabActiva === 'ventas' ? 'bg-primary text-ink-onprimary' : 'bg-surface-2 text-ink-muted hover:bg-primary-subtle hover:text-primary-ink'"
            @click="tabActiva = 'ventas'"
          >
            Ventas
          </button>
        </div>

        <div v-if="tabActiva === 'interacciones'">
          <ClientesClienteInteraccionTimeline :cliente-id="seleccionado.id" @registrada="onInteraccionRegistrada" />
        </div>

        <div v-else-if="tabActiva === 'tickets'">
          <div class="flex items-center justify-between mb-3">
            <p class="text-base font-semibold text-gray-700">Tickets de servicio técnico</p>
            <button
              v-if="can('tickets', 'create')"
              type="button"
              title="Nuevo ticket"
              class="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-ink-onprimary hover:bg-primary-hover transition-colors duration-150"
              @click="modalNuevoTicketAbierto = true"
            >
              <Icon name="mdi:plus" class="w-5 h-5" />
            </button>
          </div>
          <ul v-if="ticketsSeleccionado.length" class="space-y-2">
            <li
              v-for="t in ticketsSeleccionado"
              :key="t.id"
              class="text-sm bg-gray-50 rounded-xl p-3 flex items-center justify-between"
            >
              <NuxtLink :to="`/tickets/${t.id}`" class="hover:underline text-gray-700 font-medium">
                {{ t.titulo }}
              </NuxtLink>
              <SharedBadge :label="colorTicket(t.estado).label" :clases="colorTicket(t.estado).clases" />
            </li>
          </ul>
          <p v-else class="text-sm text-gray-400">Sin tickets todavía</p>
        </div>

        <div v-else-if="tabActiva === 'ventas'">
          <ClientesVentaList :cliente-id="seleccionado.id" />
        </div>
      </div>
    </div>
  </div>

  <div v-if="seleccionado" class="w-full min-[1700px]:w-[28rem] shrink-0">
    <SharedTareaList entidad-tipo="cliente" :entidad-id="seleccionado.id" />
  </div>

    <SharedModal
      v-if="seleccionado"
      :open="modalEditarAbierto"
      :titulo="`Editar ${seleccionado.razon_social}`"
      @cerrar="modalEditarAbierto = false"
    >
      <ClientesClienteForm :model-value="seleccionado" :cargando="guardandoEdicion" @submit="onSubmitEdicion" />
    </SharedModal>

    <SharedModal
      v-if="seleccionado"
      :open="modalNuevoTicketAbierto"
      titulo="Nuevo ticket"
      @cerrar="modalNuevoTicketAbierto = false"
    >
      <TicketsTicketForm
        :cargando="guardandoTicket"
        :cliente-id-fijo="seleccionado.id"
        :cliente-nombre-fijo="seleccionado.razon_social"
        @submit="onSubmitTicket"
      />
    </SharedModal>
  </div>
</template>
