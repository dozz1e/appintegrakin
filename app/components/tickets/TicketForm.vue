<script setup lang="ts">
import type { Ticket } from '~/composables/useTickets'
import type { Tecnico } from '~/composables/useTecnicos'
import type { Producto } from '~/composables/useProductos'

const props = defineProps<{
  modelValue?: Partial<Ticket>
  clienteIdFijo?: string
  clienteNombreFijo?: string
  cargando?: boolean
  productosAsociados?: string[]
}>()
const emit = defineEmits<{
  submit: [payload: Partial<Ticket>, archivos: File[], productosIds: string[]]
}>()

const { fetchTecnicos } = useTecnicos()
const { can } = usePermissions()
const { fetchVentasPorCliente } = useVentas()
const { fetchProductosPorIds } = useProductos()

const form = reactive<Partial<Ticket>>({
  cliente_id: props.modelValue?.cliente_id ?? props.clienteIdFijo ?? '',
  titulo: props.modelValue?.titulo ?? '',
  descripcion: props.modelValue?.descripcion ?? '',
  prioridad: props.modelValue?.prioridad ?? 'media',
  tecnico_id: props.modelValue?.tecnico_id ?? '',
})

const tecnicos = ref<Tecnico[]>([])
const comprados = ref<Pick<Producto, 'id' | 'nombre' | 'sku'>[]>([])
const productosSeleccionados = ref<string[]>([...(props.productosAsociados ?? [])])

onMounted(async () => {
  if (!props.modelValue && can('tickets', 'assign')) {
    tecnicos.value = await fetchTecnicos()
  }
})

// Al elegir/tener cliente, muestra sus productos comprados (tabla
// ventas) para unirlos al ticket - immediate porque el cliente puede
// venir prefijado (clienteIdFijo) y el watch normal no dispara con el
// valor inicial.
watch(
  () => form.cliente_id,
  async (clienteId) => {
    comprados.value = []
    if (!clienteId) return
    const ventas = await fetchVentasPorCliente(clienteId)
    const ids = [...new Set(ventas.map((v) => v.producto_id))]
    comprados.value = await fetchProductosPorIds(ids)
  },
  { immediate: true }
)

function toggleProducto(id: string) {
  const idx = productosSeleccionados.value.indexOf(id)
  if (idx === -1) productosSeleccionados.value.push(id)
  else productosSeleccionados.value.splice(idx, 1)
}

const errores = reactive<Record<string, string>>({})

const archivosAdjuntos = ref<File[]>([])
const inputArchivo = ref<HTMLInputElement | null>(null)

function onArchivoSeleccionado(e: Event) {
  archivosAdjuntos.value.push(...((e.target as HTMLInputElement).files ?? []))
  if (inputArchivo.value) inputArchivo.value.value = ''
}

function quitarAdjunto(idx: number) {
  archivosAdjuntos.value.splice(idx, 1)
}

const validar = () => {
  errores.cliente_id = form.cliente_id ? '' : 'Debes seleccionar un cliente'
  errores.titulo = form.titulo ? '' : 'El título es obligatorio'
  return !Object.values(errores).some(Boolean)
}

const onSubmit = () => {
  if (!validar()) return
  emit('submit', { ...form, tecnico_id: form.tecnico_id || null }, archivosAdjuntos.value, productosSeleccionados.value)
}

const inputClase =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]'
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Cliente *</label>
      <ClientesClienteBuscador v-if="!clienteIdFijo" v-model="form.cliente_id" />
      <input
        v-else
        type="text"
        disabled
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-500"
        :value="clienteNombreFijo ?? clienteIdFijo"
      />
      <p v-if="errores.cliente_id" class="text-sm text-red-600 mt-1">{{ errores.cliente_id }}</p>
    </div>

    <div v-if="comprados.length">
      <label class="block text-sm font-medium mb-1 text-gray-700">Productos comprados</label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="p in comprados"
          :key="p.id"
          type="button"
          class="text-xs px-2.5 py-1 rounded-full border transition-colors"
          :class="productosSeleccionados.includes(p.id)
            ? 'bg-[#1075B5] text-white border-[#1075B5]'
            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'"
          @click="toggleProducto(p.id)"
        >
          {{ p.nombre }}
        </button>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Título *</label>
      <input v-model="form.titulo" type="text" :class="inputClase" />
      <p v-if="errores.titulo" class="text-sm text-red-600 mt-1">{{ errores.titulo }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Descripción</label>
      <textarea v-model="form.descripcion" rows="4" :class="inputClase"></textarea>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Prioridad</label>
      <select v-model="form.prioridad" :class="inputClase">
        <option value="baja">Baja</option>
        <option value="media">Media</option>
        <option value="alta">Alta</option>
        <option value="urgente">Urgente</option>
      </select>
    </div>

    <div v-if="!modelValue && tecnicos.length">
      <label class="block text-sm font-medium mb-1 text-gray-700">Técnico asignado</label>
      <select v-model="form.tecnico_id" :class="inputClase">
        <option value="">Sin asignar</option>
        <option v-for="t in tecnicos" :key="t.id" :value="t.id">{{ t.nombre }}</option>
      </select>
    </div>

    <div v-if="!modelValue && archivosAdjuntos.length" class="space-y-1">
      <div v-for="(archivo, idx) in archivosAdjuntos" :key="idx" class="flex items-center gap-1 text-xs text-gray-500">
        <Icon name="mdi:paperclip" class="w-4 h-4 shrink-0" />
        <span class="truncate">{{ archivo.name }}</span>
        <button type="button" class="text-gray-400 hover:text-danger" @click="quitarAdjunto(idx)">
          <Icon name="mdi:close" class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button
        v-if="!modelValue"
        type="button"
        title="Adjuntar archivo"
        class="flex items-center gap-1.5 border-2 border-[#1075B5] bg-[#1075B5]/10 text-[#1075B5] rounded-lg px-3 py-2 text-sm font-medium hover:bg-[#1075B5] hover:text-white transition-colors shrink-0"
        @click="inputArchivo?.click()"
      >
        <Icon name="mdi:paperclip" class="w-4 h-4" />
        Adjuntar
      </button>
      <input ref="inputArchivo" type="file" multiple class="hidden" @change="onArchivoSeleccionado" />
      <button
        type="submit"
        :disabled="cargando"
        class="flex-1 bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      >
        {{ cargando ? 'Guardando...' : 'Guardar ticket' }}
      </button>
    </div>
  </form>
</template>
