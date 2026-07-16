<!-- app/components/post-venta/TicketForm.vue -->
<script setup lang="ts">
const props = defineProps<{ cargando?: boolean }>()
const emit = defineEmits<{ submit: [payload: Record<string, unknown>] }>()

const clienteDesconocido = ref(false)

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

watch(clienteDesconocido, (esDesconocido) => {
  if (esDesconocido) form.cliente_id = ''
  else {
    form.cliente_nombre_libre = ''
    form.cliente_rut_libre = ''
    form.cliente_celular_libre = ''
    form.cliente_ciudad_libre = ''
  }
})

function validar(): boolean {
  errores.n_guia = form.n_guia.trim() ? '' : 'El N° de guía es obligatorio'
  errores.cliente = clienteDesconocido.value
    ? form.cliente_nombre_libre.trim() ? '' : 'Ingresa al menos el nombre del cliente'
    : form.cliente_id ? '' : 'Debes seleccionar un cliente'
  errores.producto_id = form.producto_id ? '' : 'Debes seleccionar un equipo'
  errores.fecha_ingreso = form.fecha_ingreso ? '' : 'La fecha de ingreso es obligatoria'
  return !Object.values(errores).some(Boolean)
}

function onSubmit() {
  if (!validar()) return

  emit('submit', {
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
  })
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
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Observaciones</label>
      <textarea v-model="form.observaciones" rows="3" :class="inputClase"></textarea>
    </div>

    <button
      type="submit"
      :disabled="cargando"
      class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {{ cargando ? 'Guardando...' : 'Guardar ticket' }}
    </button>
  </form>
</template>
