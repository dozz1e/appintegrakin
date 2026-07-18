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
    class="flex items-center gap-3 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
    :class="[
      props.activo ? 'bg-primary-subtle text-primary-ink' : 'text-ink-secondary hover:bg-surface-2 hover:text-ink',
      props.colapsado ? 'justify-center' : '',
    ]"
  >
    <span
      v-if="icono"
      class="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0"
    >
      <Icon :name="icono" class="w-5 h-5" :class="props.activo ? 'text-primary' : 'text-ink-secondary'" />
    </span>
    <span
      class="truncate transition-[opacity,width] duration-150 overflow-hidden"
      :class="props.colapsado ? 'w-0 opacity-0' : 'w-auto opacity-100'"
    >
      <slot />
    </span>
  </NuxtLink>
</template>
