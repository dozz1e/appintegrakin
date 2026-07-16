<script setup lang="ts">
import type { Producto } from '~/composables/useProductos'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { fetchProductos } = useProductos()

const productos = ref<Producto[]>([])
const termino = ref('')
const abierto = ref(false)
const contenedor = ref<HTMLElement | null>(null)

let sincronizando = false

function setTerminoSincronizado(valor: string) {
  if (termino.value === valor) return
  sincronizando = true
  termino.value = valor
}

function etiqueta(p: Producto) {
  return `${p.nombre} (${p.sku})`
}

onMounted(async () => {
  productos.value = (await fetchProductos()).filter((p) => p.estado === 'activo')
  if (props.modelValue) {
    const actual = productos.value.find((p) => p.id === props.modelValue)
    if (actual) setTerminoSincronizado(etiqueta(actual))
  }
  document.addEventListener('click', onClickFuera)
})

// Reacciona a cambios externos del id (ej: selección rápida de "equipos
// comprados por el cliente" en TicketForm) - no solo al prefill inicial.
watch(
  () => props.modelValue,
  (id) => {
    if (!id) {
      setTerminoSincronizado('')
      return
    }
    const producto = productos.value.find((p) => p.id === id)
    if (producto) setTerminoSincronizado(etiqueta(producto))
  }
)

onUnmounted(() => {
  document.removeEventListener('click', onClickFuera)
})

const resultados = computed(() => {
  const q = termino.value.trim().toLowerCase()
  if (q.length < 2) return []
  return productos.value
    .filter((p) => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    .slice(0, 30)
})

watch(termino, () => {
  if (sincronizando) {
    sincronizando = false
    return
  }
  // el usuario está editando el texto tras haber elegido un equipo -
  // el id ya no corresponde a lo que se ve en pantalla, se limpia
  if (props.modelValue) emit('update:modelValue', '')
  abierto.value = termino.value.trim().length > 0
})

function elegir(producto: Producto) {
  setTerminoSincronizado(etiqueta(producto))
  abierto.value = false
  emit('update:modelValue', producto.id)
}

function onClickFuera(e: MouseEvent) {
  if (contenedor.value && !contenedor.value.contains(e.target as Node)) {
    abierto.value = false
  }
}
</script>

<template>
  <div ref="contenedor" class="relative">
    <input
      v-model="termino"
      type="text"
      placeholder="Buscar equipo por nombre o SKU..."
      class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      @focus="abierto = termino.trim().length > 0"
    />

    <div
      v-if="abierto"
      class="absolute mt-1 w-full bg-white border border-gray-100 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
    >
      <p v-if="termino.trim().length < 2" class="text-xs text-gray-400 px-3 py-2">
        Escribe al menos 2 caracteres...
      </p>
      <p v-else-if="!resultados.length" class="text-xs text-gray-400 px-3 py-2">
        Sin resultados para "{{ termino }}"
      </p>
      <template v-else>
        <button
          v-for="p in resultados"
          :key="p.id"
          type="button"
          class="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors duration-150 flex flex-col"
          @click="elegir(p)"
        >
          <span class="text-sm font-medium text-gray-800">{{ p.nombre }}</span>
          <span class="text-xs text-gray-400">{{ p.sku }}</span>
        </button>
      </template>
    </div>
  </div>
</template>
