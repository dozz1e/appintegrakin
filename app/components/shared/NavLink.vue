<script setup lang="ts">
const props = defineProps<{ to: string; activo: boolean; icono?: string; colapsado?: boolean }>()

// Sidebar colapsada = solo iconos. El texto sigue en el DOM (accesibilidad,
// lectores de pantalla) pero se oculta visualmente - así el tooltip propio
// puede tomarlo directo del slot, sin duplicar el label como prop en cada uso.
const slots = useSlots()
const textoSlot = computed(() => {
  const nodos = slots.default?.() ?? []
  return nodos.map((n) => (typeof n.children === 'string' ? n.children : '')).join('').trim()
})

// Tooltip propio en vez del title nativo del navegador (con delay y estilo
// no controlable) - se posiciona con Teleport a <body> porque el <nav> del
// sidebar tiene overflow-y-auto, que por spec CSS fuerza overflow-x a
// "auto" también (no hay forma de dejarlo "visible" solo en un eje), así
// que un tooltip absoluto dentro del nav quedaría recortado.
const linkRef = ref<any>(null)
const mostrarTooltip = ref(false)
const posicionTooltip = ref({ top: 0, left: 0 })

function onMouseEnter() {
  if (!props.colapsado) return
  const el = (linkRef.value as any)?.$el as HTMLElement | undefined
  if (!el) return
  const rect = el.getBoundingClientRect()
  posicionTooltip.value = { top: rect.top + rect.height / 2, left: rect.right + 4 }
  mostrarTooltip.value = true
}
function onMouseLeave() {
  mostrarTooltip.value = false
}
</script>

<template>
  <NuxtLink
    ref="linkRef"
    :to="props.to"
    class="flex items-center gap-3 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
    :class="[
      props.activo ? 'bg-primary-subtle text-primary-ink' : 'text-ink-secondary hover:bg-surface-2 hover:text-ink',
      props.colapsado ? 'justify-center' : '',
    ]"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
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

  <Teleport to="body">
    <span
      v-if="mostrarTooltip && colapsado"
      class="fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink text-white text-xs font-medium px-2.5 py-1.5 shadow-lg pointer-events-none"
      :style="{ top: posicionTooltip.top + 'px', left: posicionTooltip.left + 'px' }"
    >
      {{ textoSlot }}
    </span>
  </Teleport>
</template>
