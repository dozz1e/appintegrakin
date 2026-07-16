<script setup lang="ts">
import type { Venta } from '~/composables/useVentas'
import type { Producto } from '~/composables/useProductos'

const props = defineProps<{ clienteId: string }>()

const { fetchVentasPorCliente, crearVenta, actualizarVenta, eliminarVenta } = useVentas()
const { fetchProductos } = useProductos()
const { success, error } = useToast()
const { can } = usePermissions()

const ventas = ref<Venta[]>([])
const productos = ref<Producto[]>([])
const cargando = ref(true)
const guardando = ref(false)

const productoId = ref('')
const fecha = ref('')
const hora = ref('')
const valor = ref<number | null>(null)

const idEditando = ref<string | null>(null)
const productoIdEditado = ref('')
const fechaEditada = ref('')
const horaEditada = ref('')
const valorEditado = ref<number | null>(null)
const guardandoEdicion = ref(false)

const aEliminar = ref<Venta | null>(null)
const eliminando = ref(false)

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
  errores.productoId = productoId.value ? '' : 'Selecciona un producto'
  errores.fecha = fecha.value ? '' : 'Ingresa la fecha'
  errores.hora = hora.value ? '' : 'Ingresa la hora'
  errores.valor = valor.value && valor.value > 0 ? '' : 'Ingresa el valor'
  return !Object.values(errores).some(Boolean)
}

async function onSubmit() {
  if (!validar()) return
  guardando.value = true
  try {
    await crearVenta(props.clienteId, productoId.value, valor.value ?? 0, construirFecha(fecha.value, hora.value))
    productoId.value = ''
    fecha.value = ''
    hora.value = ''
    valor.value = null
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
    <div class="mb-4 space-y-1">
      <ProductosProductoBuscador v-model="productoId" />
      <p v-if="errores.productoId" class="text-xs text-red-600">{{ errores.productoId }}</p>

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
        <input
          v-model.number="valor"
          type="number"
          min="0"
          step="1"
          placeholder="Valor"
          class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        />
        <button
          :disabled="guardando"
          class="w-full sm:w-auto bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          @click="onSubmit"
        >
          Registrar venta
        </button>
      </div>
      <p v-if="errores.fecha" class="text-xs text-red-600">{{ errores.fecha }}</p>
      <p v-if="errores.hora" class="text-xs text-red-600">{{ errores.hora }}</p>
      <p v-if="errores.valor" class="text-xs text-red-600">{{ errores.valor }}</p>
    </div>

    <p v-if="cargando" class="text-sm text-gray-400">Cargando ventas...</p>
    <p v-else-if="!ventas.length" class="text-sm text-gray-400">Sin ventas todavía.</p>

    <ul v-else class="space-y-2">
      <li v-for="v in ventas" :key="v.id" class="p-2 rounded-lg bg-gray-50 text-sm">
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
  </div>
</template>
