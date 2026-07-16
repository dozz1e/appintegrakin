# Responsive — Fase 2 (parcial): Clientes ClienteSplitView

## Contexto

Primer caso de la Fase 2 (tablas/listados, pendiente general) — el
usuario reportó puntualmente que "el listado de clientes no se ve
bien". `app/components/clientes/ClienteSplitView.vue` es un layout de
3 columnas lado a lado siempre visibles: lista (`w-72`, 288px) +
detalle (`flex-1`) + tareas (`w-80`, 320px), sin ninguna variante
responsive (`app/components/clientes/ClienteSplitView.vue:103-321`,
contenedor raíz `<div class="flex gap-4 items-start">`). En celular
esto fuerza scroll horizontal y dos de las tres columnas apenas se ven.

## Diseño

**Mismo criterio que ya se usó para el Kanban: una vista a la vez en
mobile.** Debajo de `lg` (1024px): se ve la lista sola, a pantalla
completa; al tocar un cliente, la lista se oculta y aparece el
detalle (tabs Información/Interacciones/Tickets/Ventas) con las tareas
apiladas debajo (no una tercera columna), más un botón "← Volver a la
lista" (solo visible en mobile) para volver a la lista. En `lg` y para
arriba: exactamente el layout de hoy, sin cambios.

### Contenedor raíz

```html
<div class="flex flex-col lg:flex-row gap-4 items-start">
```
(antes: `flex gap-4 items-start` — se agrega `flex-col lg:flex-row`).

### Columna de lista

```html
<div
  class="w-full lg:w-72 shrink-0 bg-white border border-gray-100 rounded-2xl shadow-sm p-3 max-h-[70vh] overflow-y-auto"
  :class="seleccionadoId ? 'hidden lg:block' : ''"
>
```
(antes: `class="w-72 shrink-0 ..."`, sin el `:class` condicional). En
mobile, la lista se oculta apenas hay un cliente seleccionado; en `lg`+
siempre visible, sin cambios de comportamiento.

### Placeholder "sin selección"

```html
<div
  v-if="!seleccionado"
  class="hidden lg:block flex-1 min-w-0 bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400"
>
  Selecciona un cliente de la lista para ver su detalle.
</div>
```
Se agrega `hidden lg:block` — en mobile no hace falta este texto (la
lista ya ocupa toda la pantalla cuando no hay selección); en `lg`+
sigue apareciendo igual que hoy junto a la lista.

### Bloque de detalle (cuando hay `seleccionado`)

Se agrega un botón "← Volver a la lista" arriba de todo, visible solo
en mobile (`lg:hidden`), que limpia `seleccionadoId`:

```html
<div v-else class="flex-1 min-w-0 w-full">
  <button
    type="button"
    class="lg:hidden flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
    @click="seleccionadoId = null"
  >
    <Icon name="mdi:arrow-left" class="w-4 h-4" />
    Volver a la lista
  </button>

  <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
    ... contenido existente sin cambios ...
  </div>
</div>
```
(el `div` interior con el contenido de info/tabs/etc. no se toca —
solo se agrega el botón antes y `w-full` al wrapper).

### Columna de tareas

```html
<div v-if="seleccionado" class="w-full lg:w-80 shrink-0">
  <SharedTareaList entidad-tipo="cliente" :entidad-id="seleccionado.id" />
</div>
```
(antes: `class="w-80 shrink-0"` — pasa a `w-full lg:w-80`, con lo que
en mobile queda apilada a todo el ancho debajo del detalle en vez de
ser una tercera columna).

## Fuera de alcance

- No se toca el contenido interno de ninguna tab (Información,
  Interacciones, Tickets, Ventas) — mismo markup, solo el contenedor
  cambia de layout.
- No se aplica este patrón a otras tablas/listados de la Fase 2
  (productos, admin/auditoría, etc.) — queda pendiente, un caso a la
  vez.
- No se agrega gesto de swipe para volver — solo el botón.

## Testing (manual, sin suite automatizada)

1. Celular/ventana angosta (<1024px) en `/clientes`: se ve solo la
   lista, a todo el ancho.
2. Tocar un cliente: la lista desaparece, aparece el detalle con el
   botón "← Volver a la lista" arriba, tabs funcionando igual, y las
   tareas apiladas debajo del detalle (no al costado).
3. Tocar "← Volver a la lista": vuelve a verse la lista completa.
4. Ensanchar a ≥1024px: aparecen las 3 columnas lado a lado, igual que
   el comportamiento actual (antes de este cambio), sin botón "Volver"
   ni ocultamientos.
