<script setup lang="ts">
import type { Venta } from '~/composables/useVentas'
import type { Producto } from '~/composables/useProductos'

const props = defineProps<{ clienteId: string }>()

const { fetchVentasPorCliente, crearVenta } = useVentas()
const { fetchProductos } = useProductos()
const { success, error } = useToast()

const ventas = ref<Venta[]>([])
const productos = ref<Producto[]>([])
const cargando = ref(true)
const guardando = ref(false)

const productoId = ref('')
const valor = ref('')
const fecha = ref('')
const hora = ref('')

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

function formatearValor(valor: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor)
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function construirFecha(fecha: string, hora: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const [horas, minutos] = hora.split(':').map(Number)
  return new Date(anio, mes - 1, dia, horas, minutos, 0).toISOString()
}

function validar(): boolean {
  errores.productoId = productoId.value ? '' : 'Selecciona un producto'
  errores.valor = Number(valor.value) > 0 ? '' : 'Ingresa un valor mayor a 0'
  errores.fecha = fecha.value ? '' : 'Ingresa la fecha'
  errores.hora = hora.value ? '' : 'Ingresa la hora'
  return !Object.values(errores).some(Boolean)
}

async function onSubmit() {
  if (!validar()) return
  guardando.value = true
  try {
    await crearVenta(props.clienteId, productoId.value, Number(valor.value), construirFecha(fecha.value, hora.value))
    productoId.value = ''
    valor.value = ''
    fecha.value = ''
    hora.value = ''
    await cargar()
    success('Venta registrada')
  } catch (e) {
    error('No se pudo registrar la venta')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-4 space-y-1">
      <div class="flex flex-wrap gap-2">
        <select
          v-model="productoId"
          class="flex-1 min-w-[10rem] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        >
          <option value="" disabled>Selecciona un producto</option>
          <option v-for="p in productos" :key="p.id" :value="p.id">{{ p.nombre }}</option>
        </select>
        <input
          v-model="valor"
          type="number"
          min="1"
          placeholder="Valor"
          class="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        />
      </div>
      <p v-if="errores.productoId" class="text-xs text-red-600">{{ errores.productoId }}</p>
      <p v-if="errores.valor" class="text-xs text-red-600">{{ errores.valor }}</p>

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
    </div>

    <p v-if="cargando" class="text-sm text-gray-400">Cargando ventas...</p>
    <p v-else-if="!ventas.length" class="text-sm text-gray-400">Sin ventas todavía.</p>

    <ul v-else class="space-y-2">
      <li
        v-for="v in ventas"
        :key="v.id"
        class="flex items-center justify-between gap-3 p-2 rounded-lg bg-gray-50 text-sm"
      >
        <div class="min-w-0">
          <p class="font-medium text-gray-700 truncate">{{ nombreProducto(v.producto_id) }}</p>
          <p class="text-xs text-gray-400">{{ formatearFecha(v.fecha) }}</p>
        </div>
        <span class="font-medium text-gray-700 shrink-0">{{ formatearValor(v.valor) }}</span>
      </li>
    </ul>
  </div>
</template>
