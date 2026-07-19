<!-- app/components/post-venta/TicketForm.vue -->
<script setup lang="ts">
import type { Producto } from '~/composables/useProductos'

const props = defineProps<{ cargando?: boolean }>()
const emit = defineEmits<{ submit: [payload: Record<string, unknown>, archivo: File | null] }>()

const { fetchVentasPorCliente } = useVentas()
const { fetchProductosPorIds } = useProductos()

const clienteDesconocido = ref(false)
const comprados = ref<Pick<Producto, 'id' | 'nombre' | 'sku'>[]>([])

const form = reactive({
  n_guia: '',
  cliente_id: '',
  cliente_nombre_libre: '',
  cliente_rut_libre: '',
  cliente_celular_libre: '',
  cliente_ciudad_libre: '',
  producto_id: '',
  descripcion_falla: '',
  fecha_ingreso: new Date().toISOString().slice(0, 10),
  fecha_tope: '',
  observaciones: '',
})

const errores = reactive<Record<string, string>>({})

const archivoAdjunto = ref<File | null>(null)
const inputArchivo = ref<HTMLInputElement | null>(null)

function onArchivoSeleccionado(e: Event) {
  archivoAdjunto.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

function quitarAdjunto() {
  archivoAdjunto.value = null
  if (inputArchivo.value) inputArchivo.value.value = ''
}

watch(clienteDesconocido, (esDesconocido) => {
  if (esDesconocido) form.cliente_id = ''
  else {
    form.cliente_nombre_libre = ''
    form.cliente_rut_libre = ''
    form.cliente_celular_libre = ''
    form.cliente_ciudad_libre = ''
  }
})

// Al elegir cliente, muestra sus equipos comprados (tabla ventas) como
// acceso rápido - la mayoría de los tickets de post-venta son sobre algo
// que el cliente ya compró.
watch(
  () => form.cliente_id,
  async (clienteId) => {
    comprados.value = []
    if (!clienteId) return
    const ventas = await fetchVentasPorCliente(clienteId)
    const ids = [...new Set(ventas.map((v) => v.producto_id))]
    comprados.value = await fetchProductosPorIds(ids)
  }
)

function validar(): boolean {
  errores.n_guia = form.n_guia.trim() ? '' : 'El N° de guía es obligatorio'
  errores.cliente = clienteDesconocido.value
    ? form.cliente_nombre_libre.trim() ? '' : 'Ingresa al menos el nombre del cliente'
    : form.cliente_id ? '' : 'Debes seleccionar un cliente'
  errores.producto_id = form.producto_id ? '' : 'Debes seleccionar un equipo'
  errores.fecha_ingreso = form.fecha_ingreso ? '' : 'La fecha de ingreso es obligatoria'
  errores.fecha_tope =
    form.fecha_tope && form.fecha_ingreso && form.fecha_tope <= form.fecha_ingreso
      ? 'La fecha tope debe ser posterior a la fecha de ingreso'
      : ''
  return !Object.values(errores).some(Boolean)
}

function onSubmit() {
  if (!validar()) return

  emit(
    'submit',
    {
      n_guia: form.n_guia.trim(),
      cliente_id: clienteDesconocido.value ? null : form.cliente_id || null,
      cliente_nombre_libre: clienteDesconocido.value ? form.cliente_nombre_libre.trim() : null,
      cliente_rut_libre: clienteDesconocido.value ? form.cliente_rut_libre.trim() || null : null,
      cliente_celular_libre: clienteDesconocido.value ? form.cliente_celular_libre.trim() || null : null,
      cliente_ciudad_libre: clienteDesconocido.value ? form.cliente_ciudad_libre.trim() || null : null,
      producto_id: form.producto_id,
      descripcion_falla: form.descripcion_falla.trim() || null,
      fecha_ingreso: form.fecha_ingreso,
      fecha_tope: form.fecha_tope || null,
      observaciones: form.observaciones.trim() || null,
    },
    archivoAdjunto.value
  )
}

const inputClase =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]'
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">N° de guía *</label>
      <input v-model="form.n_guia" type="text" :class="inputClase" />
      <p v-if="errores.n_guia" class="text-sm text-red-600 mt-1">{{ errores.n_guia }}</p>
    </div>

    <div>
      <label class="flex items-center gap-2 text-sm text-gray-700 mb-2">
        <input v-model="clienteDesconocido" type="checkbox" />
        Cliente no registrado
      </label>

      <template v-if="!clienteDesconocido">
        <label class="block text-sm font-medium mb-1 text-gray-700">Cliente *</label>
        <ClientesClienteBuscador v-model="form.cliente_id" />
      </template>
      <template v-else>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="block text-sm font-medium mb-1 text-gray-700">Nombre *</label>
            <input v-model="form.cliente_nombre_libre" type="text" :class="inputClase" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700">Rut</label>
            <input v-model="form.cliente_rut_libre" type="text" :class="inputClase" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700">Celular</label>
            <input v-model="form.cliente_celular_libre" type="text" :class="inputClase" />
          </div>
          <div class="col-span-2">
            <label class="block text-sm font-medium mb-1 text-gray-700">Ciudad</label>
            <input v-model="form.cliente_ciudad_libre" type="text" :class="inputClase" />
          </div>
        </div>
      </template>
      <p v-if="errores.cliente" class="text-sm text-red-600 mt-1">{{ errores.cliente }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Equipo *</label>
      <div v-if="comprados.length" class="flex flex-wrap gap-1.5 mb-2">
        <span class="text-xs text-gray-400 self-center">Comprado por este cliente:</span>
        <button
          v-for="p in comprados"
          :key="p.id"
          type="button"
          class="text-xs px-2.5 py-1 rounded-full border transition-colors"
          :class="form.producto_id === p.id
            ? 'bg-[#1075B5] text-white border-[#1075B5]'
            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'"
          @click="form.producto_id = p.id"
        >
          {{ p.nombre }}
        </button>
      </div>
      <ProductosProductoBuscador v-model="form.producto_id" />
      <p v-if="errores.producto_id" class="text-sm text-red-600 mt-1">{{ errores.producto_id }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Descripción de la falla</label>
      <textarea v-model="form.descripcion_falla" rows="3" :class="inputClase"></textarea>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Fecha de ingreso *</label>
        <input v-model="form.fecha_ingreso" type="date" :class="inputClase" @click="abrirPicker" />
        <p v-if="errores.fecha_ingreso" class="text-sm text-red-600 mt-1">{{ errores.fecha_ingreso }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Fecha tope</label>
        <input v-model="form.fecha_tope" type="date" :class="inputClase" @click="abrirPicker" />
        <p v-if="errores.fecha_tope" class="text-sm text-red-600 mt-1">{{ errores.fecha_tope }}</p>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Observaciones</label>
      <textarea v-model="form.observaciones" rows="3" :class="inputClase"></textarea>
    </div>

    <div v-if="archivoAdjunto" class="flex items-center gap-1 text-xs text-gray-500">
      <Icon name="mdi:image-outline" class="w-4 h-4 shrink-0" />
      <span class="truncate">{{ archivoAdjunto.name }}</span>
      <button type="button" class="text-gray-400 hover:text-danger" @click="quitarAdjunto">
        <Icon name="mdi:close" class="w-3.5 h-3.5" />
      </button>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        title="Adjuntar imagen"
        class="flex items-center gap-1.5 border-2 border-[#1075B5] bg-[#1075B5]/10 text-[#1075B5] rounded-lg px-3 py-2 text-sm font-medium hover:bg-[#1075B5] hover:text-white transition-colors shrink-0"
        @click="inputArchivo?.click()"
      >
        <Icon name="mdi:paperclip" class="w-4 h-4" />
        Adjuntar
      </button>
      <input ref="inputArchivo" type="file" accept="image/*" class="hidden" @change="onArchivoSeleccionado" />
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
