# Responsive — Fase 1: Shell (sidebar + topbar)

## Contexto

El equipo (vendedoras/técnicos) va a empezar a usar el CRM desde el
celular en terreno, no solo desde escritorio. Es un cambio grande
(sidebar, tablas, Kanban, formularios, vistas de detalle multi-columna
en ~20+ páginas), así que se parte en fases. Esta es la **Fase 1**:
hacer responsive el shell de la app (`app/layouts/default.vue`) —
sidebar y topbar. Fases siguientes (no cubiertas acá, quedan como
pendientes): tablas/listados, Kanban, formularios/modales/vistas de
detalle multi-columna.

Estado actual (`app/layouts/default.vue`):
- `<aside class="w-64 ... flex flex-col shrink-0">`: sidebar fijo,
  siempre visible, parte del flex layout normal (`shrink-0` dentro de
  `<div class="min-h-screen bg-bg flex">`). Sin ningún comportamiento
  responsive — en una pantalla de celular (375px) ocupa 256px fijos,
  dejando ~119px para el contenido.
- `<header class="h-16 ... flex items-center justify-between px-6 ...">`:
  buscador (`flex-1 max-w-md`) + campanita + avatar. Sin botón de menú,
  sin ajuste de padding para pantallas chicas.
- Precedente ya usado en el proyecto para colapsar en mobile: breakpoint
  `lg` (1024px) — `grid-cols-1 lg:grid-cols-[1.3fr_1fr]` en
  `app/pages/tickets/[id].vue`. Se reutiliza el mismo breakpoint acá
  para consistencia.

## Diseño

**Patrón elegido: drawer superpuesto** (no barra de tabs abajo, no
sidebar angosto solo-íconos) — hay demasiadas secciones (CRM, Leads,
Servicio Técnico, Post Venta, Capacitaciones, Administración, Sistema)
para un tab bar, y un rail solo-íconos queda muy apretado para dedos en
celular real.

- **`lg` (1024px) y para arriba**: sidebar fijo, siempre visible, exactamente
  el comportamiento de hoy.
- **Debajo de `lg`**: sidebar oculto por defecto, se abre como panel
  superpuesto (`fixed`, no ocupa espacio del layout) con fondo oscuro
  detrás (backdrop). Se cierra al tocar el backdrop, al navegar a
  cualquier link, o (implícito) al cambiar a `lg` o más ancho.

### `app/layouts/default.vue`

Nuevo estado:
```ts
const mobileMenuAbierto = ref(false)

watch(() => route.path, () => { mobileMenuAbierto.value = false })
```

`<aside>` pasa de:
```html
<aside class="w-64 bg-surface border-r border-border flex flex-col shrink-0">
```
a:
```html
<aside
  class="fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-border flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 lg:shrink-0"
  :class="mobileMenuAbierto ? 'translate-x-0' : '-translate-x-full'"
>
```
`fixed` + `-translate-x-full`/`translate-x-0` controla el drawer en
mobile (no ocupa espacio del flex layout mientras está fuera de
pantalla); `lg:static lg:translate-x-0 lg:shrink-0` restaura el
comportamiento de hoy en desktop, ignorando el estado de
`mobileMenuAbierto` (a `lg` o más, siempre visible y en flujo normal).

Backdrop nuevo, antes del `<aside>` o después (cualquier orden, ambos
`fixed`):
```html
<div
  v-if="mobileMenuAbierto"
  class="fixed inset-0 bg-black/50 z-30 lg:hidden"
  @click="mobileMenuAbierto = false"
/>
```

`<header>` pasa de:
```html
<header class="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
  <div class="flex-1 max-w-md">
    <SharedGlobalSearch />
  </div>
  <div class="flex items-center gap-3">
```
a:
```html
<header class="h-16 bg-surface border-b border-border flex items-center gap-3 px-4 sm:px-6 shrink-0">
  <button
    type="button"
    class="lg:hidden text-ink-secondary hover:text-ink p-2 -ml-2"
    @click="mobileMenuAbierto = true"
  >
    <Icon name="mdi:menu" class="w-6 h-6" />
  </button>
  <div class="flex-1 min-w-0 max-w-md">
    <SharedGlobalSearch />
  </div>
  <div class="flex items-center gap-3 shrink-0">
```
Cambios puntuales: `justify-between` se saca (ya no hace falta, el
botón hamburguesa + `flex-1` en el buscador ya empujan la campanita/avatar
a la derecha); `min-w-0` en el contenedor del buscador para que pueda
angostarse dentro del flex row sin desbordar ahora que hay un elemento
más (el botón); padding horizontal `px-4 sm:px-6` (menos margen en
celular). El botón usa `lg:hidden` — invisible en desktop, donde el
sidebar ya está siempre visible y no hace falta abrirlo.

## Fuera de alcance

- Tablas/listados, Kanban, formularios/modales, vistas de detalle
  multi-columna — fases siguientes, specs separadas.
- No se cambia el contenido del nav (mismos links/íconos/permisos) —
  solo cómo se muestra/oculta el contenedor.
- No se agrega gesto de swipe para abrir/cerrar el drawer (solo botón +
  backdrop + navegación).
- `GlobalSearch.vue`, `NotificationBell.vue`, `UserMenu.vue` no se
  tocan por dentro — si sus propios dropdowns no se ven bien en mobile,
  es parte de una fase posterior, no de esta.

## Testing (manual, sin suite automatizada)

1. Ventana angosta (< 1024px, o DevTools mobile): sidebar no se ve por
   defecto, contenido ocupa todo el ancho.
2. Tocar el botón hamburguesa: sidebar aparece como panel superpuesto
   con fondo oscuro detrás; los links y permisos se ven igual que en
   desktop.
3. Tocar el fondo oscuro: el panel se cierra.
4. Tocar un link de navegación: navega Y el panel se cierra solo.
5. Ensanchar la ventana a ≥1024px: sidebar siempre visible, sin botón
   hamburguesa, sin fondo oscuro — igual que el comportamiento actual
   (antes de este cambio).
6. Angostar de nuevo a <1024px estando en una página cualquiera: el
   buscador/campanita/avatar del topbar no se solapan ni desbordan.
