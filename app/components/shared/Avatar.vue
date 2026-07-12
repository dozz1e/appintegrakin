<script setup lang="ts">
const props = defineProps<{ nombre: string; size?: 'sm' | 'md'; imagenUrl?: string | null }>()

const errorImagen = ref(false)

watch(
  () => props.imagenUrl,
  () => {
    errorImagen.value = false
  }
)

const paleta = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
]

const iniciales = computed(() => {
  const partes = props.nombre.trim().split(/\s+/)
  const letras = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '')
  return letras.join('') || '?'
})

const colorClase = computed(() => {
  const hash = props.nombre.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return paleta[hash % paleta.length]
})

const tamano = computed(() => (props.size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'))
</script>

<template>
  <img
    v-if="imagenUrl && !errorImagen"
    :src="imagenUrl"
    :alt="nombre"
    class="inline-block rounded-full object-cover shrink-0"
    :class="tamano"
    @error="errorImagen = true"
  />
  <span
    v-else
    class="inline-flex items-center justify-center rounded-full font-medium shrink-0"
    :class="[colorClase, tamano]"
  >
    {{ iniciales }}
  </span>
</template>
