<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { buscarClientes, getCliente } = useClientes()

const termino = ref('')
const resultados = ref<Cliente[]>([])
const cargando = ref(false)
const abierto = ref(false)
const contenedor = ref<HTMLElement | null>(null)

let debounceHandle: ReturnType<typeof setTimeout> | null = null
let sincronizando = false

function setTerminoSincronizado(valor: string) {
  sincronizando = true
  termino.value = valor
}

onMounted(async () => {
  if (props.modelValue) {
    try {
      const cliente = await getCliente(props.modelValue)
      setTerminoSincronizado(cliente.razon_social)
    } catch {
      // el id ya no existe o no es visible por RLS - se deja el input vacío
    }
  }
  document.addEventListener('click', onClickFuera)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickFuera)
  if (debounceHandle) clearTimeout(debounceHandle)
})

watch(termino, (nuevo) => {
  // escritura programática (prefill al montar o selección de un resultado) -
  // no dispara ni la búsqueda ni la limpieza de integridad, solo tipeo real
  if (sincronizando) {
    sincronizando = false
    return
  }

  if (debounceHandle) clearTimeout(debounceHandle)

  // el usuario está editando el texto tras haber elegido un cliente -
  // el id ya no corresponde a lo que se ve en pantalla, se limpia
  if (props.modelValue) emit('update:modelValue', '')

  if (nuevo.trim().length < 2) {
    resultados.value = []
    abierto.value = nuevo.trim().length > 0
    return
  }

  cargando.value = true
  abierto.value = true
  debounceHandle = setTimeout(async () => {
    try {
      resultados.value = await buscarClientes(nuevo)
    } catch {
      resultados.value = []
    } finally {
      cargando.value = false
    }
  }, 300)
})

function elegir(cliente: Cliente) {
  setTerminoSincronizado(cliente.razon_social)
  abierto.value = false
  resultados.value = []
  emit('update:modelValue', cliente.id)
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
      placeholder="Buscar por razón social, RUT o contacto..."
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
      <p v-else-if="cargando" class="text-xs text-gray-400 px-3 py-2">Buscando...</p>
      <p v-else-if="!resultados.length" class="text-xs text-gray-400 px-3 py-2">
        Sin resultados para "{{ termino }}"
      </p>
      <template v-else>
        <button
          v-for="c in resultados"
          :key="c.id"
          type="button"
          class="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors duration-150 flex flex-col"
          @click="elegir(c)"
        >
          <span class="text-sm font-medium text-gray-800">{{ c.razon_social }}</span>
          <span class="text-xs text-gray-400">{{ c.rut || c.nombre_contacto || '' }}</span>
        </button>
      </template>
    </div>
  </div>
</template>
