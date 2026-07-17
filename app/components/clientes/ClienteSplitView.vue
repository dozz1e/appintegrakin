<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'
import type { Ticket } from '~/composables/useTickets'
import type { Usuario } from '~/composables/useUsuarios'

const props = defineProps<{ clientes: Cliente[]; usuarios: Usuario[]; clienteIdInicial?: string }>()
const emit = defineEmits<{ eliminar: [cliente: Cliente]; actualizar: [cliente: Cliente] }>()

const { fetchTicketsPorCliente } = useTickets()
const { fetchUltimasInteracciones } = useClienteInteracciones()
const { asignarCliente, updateCliente, subirImagenCliente } = useClientes()
const { can } = usePermissions()
const { success, error } = useToast()

const asignando = ref(false)
const modalEditarAbierto = ref(false)
const guardandoEdicion = ref(false)

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
const ticketsSeleccionado = ref<Ticket[]>([])
const tabActiva = ref<'info' | 'tickets' | 'ventas' | 'interacciones'>('info')
const ultimasInteracciones = ref<Record<string, string>>({})

const puedeVerTickets = computed(() => can('tickets', 'view') || can('tickets', 'view_all'))
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

const clientesFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  return props.clientes.filter((c) => {
    if (
      q &&
      !c.razon_social.toLowerCase().includes(q) &&
      !(c.nombre_contacto ?? '').toLowerCase().includes(q) &&
      !(c.rut ?? '').toLowerCase().includes(q)
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

const totalTickets = computed(() => ticketsSeleccionado.value.length)
const ticketsAbiertos = computed(() => ticketsSeleccionado.value.filter((t) => t.estado !== 'cerrado').length)
const ticketsResueltos = computed(() => ticketsSeleccionado.value.filter((t) => t.estado === 'resuelto').length)

watch(seleccionadoId, async (id) => {
  tabActiva.value = 'info'
  ticketsSeleccionado.value = []
  if (id && puedeVerTickets.value) {
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
  <div class="flex gap-4 items-start">
    <div class="w-72 shrink-0 bg-white border border-gray-100 rounded-2xl shadow-sm p-3 max-h-[70vh] overflow-y-auto">
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
      <ul class="space-y-1">
        <li
          v-for="c in clientesFiltrados"
          :key="c.id"
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
      class="flex-1 min-w-0 bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400"
    >
      Selecciona un cliente de la lista para ver su detalle.
    </div>

    <div v-else class="flex-1 min-w-0">
      <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <div class="flex items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-3">
            <SharedAvatar :nombre="seleccionado.razon_social" :imagen-url="seleccionado.imagen_url" size="md" />
            <div>
              <h2 class="text-lg font-semibold text-gray-800">{{ seleccionado.razon_social }}</h2>
              <p v-if="seleccionado.nombre_contacto" class="text-xs text-gray-400">{{ seleccionado.nombre_contacto }}</p>
            </div>
          </div>
          <button
            v-if="can('clientes', 'delete')"
            type="button"
            class="text-red-600 hover:underline text-sm font-medium shrink-0"
            @click="emit('eliminar', seleccionado)"
          >
            Eliminar
          </button>
        </div>

        <div v-if="puedeVerTickets" class="grid grid-cols-3 gap-3 mb-4">
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

        <div class="flex gap-2 mb-4">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-base font-medium transition-colors"
            :class="tabActiva === 'info' ? 'bg-primary text-ink-onprimary' : 'bg-surface-2 text-ink-muted hover:bg-primary-subtle hover:text-primary-ink'"
            @click="tabActiva = 'info'"
          >
            Información
          </button>
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-base font-medium transition-colors"
            :class="tabActiva === 'interacciones' ? 'bg-primary text-ink-onprimary' : 'bg-surface-2 text-ink-muted hover:bg-primary-subtle hover:text-primary-ink'"
            @click="tabActiva = 'interacciones'"
          >
            Interacciones
          </button>
          <button
            v-if="puedeVerTickets"
            type="button"
            class="rounded-lg px-4 py-2 text-base font-medium transition-colors"
            :class="tabActiva === 'tickets' ? 'bg-primary text-ink-onprimary' : 'bg-surface-2 text-ink-muted hover:bg-primary-subtle hover:text-primary-ink'"
            @click="tabActiva = 'tickets'"
          >
            Tickets
          </button>
          <button
            v-if="puedeVerVentas"
            type="button"
            class="rounded-lg px-4 py-2 text-base font-medium transition-colors"
            :class="tabActiva === 'ventas' ? 'bg-primary text-ink-onprimary' : 'bg-surface-2 text-ink-muted hover:bg-primary-subtle hover:text-primary-ink'"
            @click="tabActiva = 'ventas'"
          >
            Ventas
          </button>
        </div>

        <div v-if="tabActiva === 'info'" class="space-y-4">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-xs text-gray-400 mb-1">RUT</p>
              <p class="text-gray-700">{{ seleccionado.rut || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Nombre de contacto</p>
              <p class="text-gray-700">{{ seleccionado.nombre_contacto || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Teléfono</p>
              <p class="text-gray-700">{{ seleccionado.telefono || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Email</p>
              <p class="text-gray-700">{{ seleccionado.email || '—' }}</p>
            </div>
            <div class="col-span-2">
              <p class="text-xs text-gray-400 mb-1">Dirección</p>
              <p class="text-gray-700">{{ seleccionado.direccion || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Comuna</p>
              <p class="text-gray-700">{{ seleccionado.comuna || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Ciudad</p>
              <p class="text-gray-700">{{ seleccionado.ciudad || '—' }}</p>
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

          <button
            v-if="can('clientes', 'edit')"
            type="button"
            class="inline-flex items-center gap-1 text-sm text-[#1075B5] hover:underline font-medium"
            @click="modalEditarAbierto = true"
          >
            <Icon name="mdi:pencil-outline" class="w-4 h-4" />
            Editar cliente
          </button>
        </div>

        <div v-else-if="tabActiva === 'interacciones'">
          <ClientesClienteInteraccionTimeline :cliente-id="seleccionado.id" @registrada="onInteraccionRegistrada" />
        </div>

        <div v-else-if="tabActiva === 'tickets'">
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-semibold text-gray-700">Tickets de servicio técnico</p>
            <NuxtLink
              v-if="can('tickets', 'create')"
              :to="`/tickets/nuevo?cliente_id=${seleccionado.id}`"
              class="text-xs text-[#1075B5] hover:underline font-medium"
            >
              + Nuevo ticket
            </NuxtLink>
          </div>
          <ul v-if="ticketsSeleccionado.length" class="space-y-2">
            <li
              v-for="t in ticketsSeleccionado"
              :key="t.id"
              class="text-sm border border-gray-100 border-l-4 border-l-gray-300 rounded-xl p-3 flex items-center justify-between"
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
          <p class="text-sm font-semibold text-gray-700 mb-3">Ventas</p>
          <ClientesVentaList :cliente-id="seleccionado.id" />
        </div>
      </div>
    </div>

    <div v-if="seleccionado" class="w-[28rem] shrink-0">
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
  </div>
</template>
