<script setup lang="ts">
import type { Venta } from '~/composables/useVentas'
import type { Producto } from '~/composables/useProductos'

const props = defineProps<{ clienteId: string }>()

const { fetchVentasPorCliente, crearVentas, actualizarVenta, eliminarVenta } = useVentas()
const { fetchProductos } = useProductos()
const { success, error } = useToast()
const { can } = usePermissions()

const ventas = ref<Venta[]>([])
const productos = ref<Producto[]>([])
const cargando = ref(true)
const guardando = ref(false)

interface LineaVentaForm {
  productoId: string
  cantidad: number
}

const lineas = ref<LineaVentaForm[]>([{ productoId: '', cantidad: 1 }])
const erroresLineas = ref<string[]>([])
const fecha = ref('')
const hora = ref('')

function agregarLinea() {
  lineas.value.push({ productoId: '', cantidad: 1 })
}

function quitarLinea(index: number) {
  if (lineas.value.length <= 1) return
  lineas.value.splice(index, 1)
}

const idEditando = ref<string | null>(null)
const productoIdEditado = ref('')
const fechaEditada = ref('')
const horaEditada = ref('')
const valorEditado = ref<number | null>(null)
const guardandoEdicion = ref(false)

const aEliminar = ref<Venta | null>(null)
const eliminando = ref(false)
const modalNuevaAbierta = ref(false)

const errores = reactive<Record<string, string>>({})

async function cargar() {
  cargando.value = true
  const [v, p] = await Promise.all([fetchVentasPorCliente(props.clienteId), fetchProductos()])
  ventas.value = v
  productos.value = p
  cargando.value = false
}

onMounted(cargar)

function nombreProducto(productoId: string) {
  return productos.value.find((p) => p.id === productoId)?.nombre ?? '—'
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatearValor(valor: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor)
}

function construirFecha(fecha: string, hora: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const [horas, minutos] = hora.split(':').map(Number)
  return new Date(anio, mes - 1, dia, horas, minutos, 0).toISOString()
}

function aFechaInput(fechaIso: string): string {
  const d = new Date(fechaIso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function aHoraInput(fechaIso: string): string {
  const d = new Date(fechaIso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function validar(): boolean {
  erroresLineas.value = lineas.value.map((l) => {
    if (!l.productoId) return 'Selecciona un producto'
    if (!l.cantidad || l.cantidad < 1) return 'Cantidad inválida'
    return ''
  })
  errores.fecha = fecha.value ? '' : 'Ingresa la fecha'
  errores.hora = hora.value ? '' : 'Ingresa la hora'
  return !erroresLineas.value.some(Boolean) && !errores.fecha && !errores.hora
}

async function onSubmit() {
  if (!validar()) return
  guardando.value = true
  try {
    await crearVentas(
      props.clienteId,
      lineas.value.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
      construirFecha(fecha.value, hora.value)
    )
    lineas.value = [{ productoId: '', cantidad: 1 }]
    erroresLineas.value = []
    fecha.value = ''
    hora.value = ''
    modalNuevaAbierta.value = false
    await cargar()
    success('Venta registrada')
  } catch (e) {
    error('No se pudo registrar la venta')
  } finally {
    guardando.value = false
  }
}

function onEditar(venta: Venta) {
  idEditando.value = venta.id
  productoIdEditado.value = venta.producto_id
  fechaEditada.value = aFechaInput(venta.fecha)
  horaEditada.value = aHoraInput(venta.fecha)
  valorEditado.value = venta.valor
}

function onCancelarEdicion() {
  idEditando.value = null
}

async function onGuardarEdicion(venta: Venta) {
  if (!productoIdEditado.value || !fechaEditada.value || !horaEditada.value || !valorEditado.value || valorEditado.value <= 0) return
  guardandoEdicion.value = true
  try {
    const actualizada = await actualizarVenta(
      venta.id,
      {
        producto_id: productoIdEditado.value,
        fecha: construirFecha(fechaEditada.value, horaEditada.value),
        valor: valorEditado.value,
      },
      venta.version
    )
    const idx = ventas.value.findIndex((v) => v.id === venta.id)
    if (idx !== -1) ventas.value[idx] = actualizada
    idEditando.value = null
    success('Venta actualizada')
  } catch (e: any) {
    if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó esta venta. Se recargó la lista, revisa e intenta de nuevo.')
      await cargar()
      idEditando.value = null
    } else {
      error('No se pudo actualizar la venta')
    }
  } finally {
    guardandoEdicion.value = false
  }
}

async function onConfirmarEliminar() {
  if (!aEliminar.value) return
  eliminando.value = true
  try {
    await eliminarVenta(aEliminar.value.id)
    ventas.value = ventas.value.filter((v) => v.id !== aEliminar.value?.id)
    aEliminar.value = null
    success('Venta eliminada')
  } catch (e) {
    error('No se pudo eliminar la venta')
  } finally {
    eliminando.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <p class="text-base font-semibold text-gray-700">Historial de ventas</p>
      <button
        type="button"
        title="Registrar venta"
        class="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-ink-onprimary hover:bg-primary-hover transition-colors duration-150"
        @click="modalNuevaAbierta = true"
      >
        <Icon name="mdi:plus" class="w-5 h-5" />
      </button>
    </div>

    <p v-if="cargando" class="text-sm text-gray-400">Cargando ventas...</p>
    <p v-else-if="!ventas.length" class="text-sm text-gray-400">Sin ventas todavía.</p>

    <ul v-else class="space-y-2">
      <li v-for="v in ventas" :key="v.id" class="py-2.5 px-3 rounded-xl bg-gray-50 text-sm">
        <div v-if="idEditando === v.id" class="space-y-2">
          <ProductosProductoBuscador v-model="productoIdEditado" />
          <div class="flex flex-wrap gap-2">
            <input
              v-model="fechaEditada"
              type="date"
              class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
            />
            <input
              v-model="horaEditada"
              type="time"
              class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
            />
            <input
              v-model.number="valorEditado"
              type="number"
              min="0"
              step="1"
              class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
            />
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="guardandoEdicion"
              class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              @click="onGuardarEdicion(v)"
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
        <div v-else class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium text-gray-700 truncate">{{ nombreProducto(v.producto_id) }}</p>
            <p class="text-xs text-gray-400">{{ formatearFecha(v.fecha) }} · {{ formatearValor(v.valor) }}</p>
          </div>
          <div class="flex gap-3 shrink-0">
            <button
              v-if="can('ventas', 'edit')"
              type="button"
              class="text-gray-300 hover:text-[#1075B5] transition-colors p-1"
              title="Editar"
              @click="onEditar(v)"
            >
              <Icon name="mdi:pencil-outline" class="w-5 h-5" />
            </button>
            <button
              v-if="can('ventas', 'delete')"
              type="button"
              class="text-gray-300 hover:text-red-600 transition-colors p-1"
              title="Eliminar"
              @click="aEliminar = v"
            >
              <Icon name="mdi:trash-can-outline" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </li>
    </ul>

    <SharedConfirmDialog
      :open="!!aEliminar"
      titulo="Eliminar venta"
      mensaje="¿Eliminar esta venta? Esta acción no se puede deshacer."
      :cargando="eliminando"
      @confirmar="onConfirmarEliminar"
      @cancelar="aEliminar = null"
    />

    <SharedModal :open="modalNuevaAbierta" titulo="Registrar venta" @cerrar="modalNuevaAbierta = false">
      <div class="space-y-3">
        <div v-for="(linea, i) in lineas" :key="i" class="space-y-1">
          <div class="flex items-start gap-2">
            <div class="flex-1 min-w-0">
              <ProductosProductoBuscador v-model="linea.productoId" />
            </div>
            <input
              v-model.number="linea.cantidad"
              type="number"
              min="1"
              step="1"
              title="Cantidad"
              class="w-20 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
            />
            <button
              v-if="lineas.length > 1"
              type="button"
              class="text-gray-300 hover:text-red-600 transition-colors p-2"
              title="Quitar equipo"
              @click="quitarLinea(i)"
            >
              <Icon name="mdi:close" class="w-5 h-5" />
            </button>
          </div>
          <p v-if="erroresLineas[i]" class="text-xs text-red-600">{{ erroresLineas[i] }}</p>
        </div>

        <button
          type="button"
          class="text-sm font-medium text-[#1075B5] hover:text-[#0C5D91] transition-colors"
          @click="agregarLinea"
        >
          + Agregar equipo
        </button>

        <div class="flex flex-wrap gap-2 pt-1">
          <input
            v-model="fecha"
            type="date"
            class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
          />
          <input
            v-model="hora"
            type="time"
            class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
          />
        </div>
        <p v-if="errores.fecha" class="text-xs text-red-600">{{ errores.fecha }}</p>
        <p v-if="errores.hora" class="text-xs text-red-600">{{ errores.hora }}</p>

        <button
          :disabled="guardando"
          class="w-full bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 mt-1"
          @click="onSubmit"
        >
          Registrar venta
        </button>
      </div>
    </SharedModal>
  </div>
</template>
