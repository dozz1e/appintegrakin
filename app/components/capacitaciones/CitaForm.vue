<script setup lang="ts">
import type { CitaCapacitacion } from '~/composables/useCitasCapacitacion'
import type { Producto } from '~/composables/useProductos'
import type { Usuario } from '~/composables/useUsuarios'

const props = defineProps<{ modelValue?: Partial<CitaCapacitacion>; cargando?: boolean }>()
const emit = defineEmits<{ submit: [payload: Record<string, unknown>] }>()

const { fetchProductos } = useProductos()
const { fetchUsuariosPorRol } = useUsuarios()
const user = useSupabaseUser()

const productos = ref<Producto[]>([])
const responsables = ref<Usuario[]>([])
const esEditando = computed(() => !!props.modelValue?.id)

function aFechaInput(fechaIso?: string): string {
  if (!fechaIso) return ''
  const d = new Date(fechaIso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function aHoraInput(fechaIso?: string): string {
  if (!fechaIso) return ''
  const d = new Date(fechaIso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const form = reactive({
  cliente_id: props.modelValue?.cliente_id ?? '',
  producto_id: props.modelValue?.producto_id ?? '',
  titulo: props.modelValue?.titulo ?? '',
  notas: props.modelValue?.notas ?? '',
  fecha: aFechaInput(props.modelValue?.fecha_hora),
  hora: aHoraInput(props.modelValue?.fecha_hora),
  owner_id: props.modelValue?.owner_id ?? user.value?.sub ?? '',
})

const errores = reactive<Record<string, string>>({})

onMounted(async () => {
  productos.value = (await fetchProductos()).filter((p) => p.estado === 'activo')
  responsables.value = await fetchUsuariosPorRol('capacitaciones')
})

function validar(): boolean {
  errores.cliente_id = form.cliente_id ? '' : 'Debes seleccionar un cliente'
  errores.producto_id = form.producto_id ? '' : 'Debes seleccionar un producto'
  errores.titulo = form.titulo.trim() ? '' : 'El tema es obligatorio'
  errores.fecha = form.fecha ? '' : 'La fecha es obligatoria'
  errores.hora = form.hora ? '' : 'La hora es obligatoria'
  return !Object.values(errores).some(Boolean)
}

function onSubmit() {
  if (!validar()) return
  const [anio, mes, dia] = form.fecha.split('-').map(Number)
  const [horas, minutos] = form.hora.split(':').map(Number)
  const fecha_hora = new Date(anio, mes - 1, dia, horas, minutos).toISOString()

  emit('submit', {
    cliente_id: form.cliente_id,
    producto_id: form.producto_id,
    titulo: form.titulo.trim(),
    notas: form.notas.trim() || null,
    fecha_hora,
    owner_id: form.owner_id || undefined,
  })
}

const inputClase =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]'
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Cliente *</label>
      <ClientesClienteBuscador v-model="form.cliente_id" />
      <p v-if="errores.cliente_id" class="text-sm text-red-600 mt-1">{{ errores.cliente_id }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Producto *</label>
      <select v-model="form.producto_id" :class="inputClase">
        <option value="">Selecciona un producto</option>
        <option v-for="p in productos" :key="p.id" :value="p.id">{{ p.nombre }}</option>
      </select>
      <p v-if="errores.producto_id" class="text-sm text-red-600 mt-1">{{ errores.producto_id }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Tema *</label>
      <input v-model="form.titulo" type="text" :class="inputClase" />
      <p v-if="errores.titulo" class="text-sm text-red-600 mt-1">{{ errores.titulo }}</p>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Fecha *</label>
        <input v-model="form.fecha" type="date" :class="inputClase" />
        <p v-if="errores.fecha" class="text-sm text-red-600 mt-1">{{ errores.fecha }}</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Hora *</label>
        <input v-model="form.hora" type="time" :class="inputClase" />
        <p v-if="errores.hora" class="text-sm text-red-600 mt-1">{{ errores.hora }}</p>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Responsable</label>
      <select v-model="form.owner_id" :disabled="esEditando" :class="[inputClase, esEditando && 'bg-gray-100 cursor-not-allowed']">
        <option v-for="r in responsables" :key="r.id" :value="r.id">{{ r.full_name || r.email }}</option>
      </select>
      <p v-if="esEditando" class="text-xs text-gray-500 mt-1">El responsable no se puede cambiar después de creada la cita.</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Notas</label>
      <textarea v-model="form.notas" rows="3" :class="inputClase"></textarea>
    </div>

    <button
      type="submit"
      :disabled="cargando"
      class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {{ cargando ? 'Guardando...' : 'Guardar capacitación' }}
    </button>
  </form>
</template>
