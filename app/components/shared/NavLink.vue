<script setup lang="ts">
const props = defineProps<{ to: string; activo: boolean; icono?: string; colapsado?: boolean }>()

// Sidebar colapsada = solo iconos. El texto sigue en el DOM (accesibilidad,
// lectores de pantalla) pero se oculta visualmente - así el <title> puede
// tomarlo directo del slot para el tooltip nativo on hover, sin duplicar el
// label como prop en cada uso.
const slots = useSlots()
const textoSlot = computed(() => {
  const nodos = slots.default?.() ?? []
  return nodos.map((n) => (typeof n.children === 'string' ? n.children : '')).join('').trim()
})
</script>

<template>
  <NuxtLink
    :to="props.to"
    :title="props.colapsado ? textoSlot : undefined"
    class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
    :class="[
      props.activo ? 'bg-primary-subtle text-primary-ink' : 'text-ink-secondary hover:bg-surface-2 hover:text-ink',
      props.colapsado ? 'justify-center px-0' : '',
    ]"
  >
    <Icon v-if="icono" :name="icono" class="w-4 h-4 shrink-0" />
    <span
      class="truncate transition-[opacity,width] duration-150 overflow-hidden"
      :class="props.colapsado ? 'w-0 opacity-0' : 'w-auto opacity-100'"
    >
      <slot />
    </span>
  </NuxtLink>
</template>
