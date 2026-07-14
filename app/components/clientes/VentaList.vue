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
const busquedaProducto = ref('')
const buscadorAbierto = ref(false)
const contenedorBuscador = ref<HTMLElement | null>(null)
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

onMounted(() => {
  cargar()
  document.addEventListener('click', onClickFueraBuscador)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickFueraBuscador)
})

function nombreProducto(productoId: string) {
  return productos.value.find((p) => p.id === productoId)?.nombre ?? '—'
}

const productosFiltrados = computed(() => {
  const q = busquedaProducto.value.trim().toLowerCase()
  if (!q) return productos.value
  return productos.value.filter(
    (p) => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
  )
})

function elegirProducto(p: Producto) {
  productoId.value = p.id
  busquedaProducto.value = p.nombre
  buscadorAbierto.value = false
}

function onClickFueraBuscador(e: MouseEvent) {
  if (contenedorBuscador.value && !contenedorBuscador.value.contains(e.target as Node)) {
    buscadorAbierto.value = false
  }
}

watch(busquedaProducto, (nuevo) => {
  if (productoId.value && nuevo !== nombreProducto(productoId.value)) {
    productoId.value = ''
  }
})

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
  errores.fecha = fecha.value ? '' : 'Ingresa la fecha'
  errores.hora = hora.value ? '' : 'Ingresa la hora'
  return !Object.values(errores).some(Boolean)
}

async function onSubmit() {
  if (!validar()) return
  guardando.value = true
  try {
    await crearVenta(props.clienteId, productoId.value, 0, construirFecha(fecha.value, hora.value))
    productoId.value = ''
    busquedaProducto.value = ''
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
        <div ref="contenedorBuscador" class="relative flex-1 min-w-[10rem]">
          <input
            v-model="busquedaProducto"
            type="text"
            placeholder="Buscar por nombre o SKU..."
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
            @focus="buscadorAbierto = true"
          />
          <div
            v-if="buscadorAbierto"
            class="absolute mt-1 w-full bg-white border border-gray-100 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
          >
            <p v-if="!productosFiltrados.length" class="text-xs text-gray-400 px-3 py-2">
              Sin resultados para "{{ busquedaProducto }}"
            </p>
            <button
              v-for="p in productosFiltrados"
              :key="p.id"
              type="button"
              class="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors duration-150 flex flex-col"
              @click="elegirProducto(p)"
            >
              <span class="text-sm font-medium text-gray-800">{{ p.nombre }}</span>
              <span class="text-xs text-gray-400">{{ p.sku }}</span>
            </button>
          </div>
        </div>
      </div>
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
      </li>
    </ul>
  </div>
</template>
