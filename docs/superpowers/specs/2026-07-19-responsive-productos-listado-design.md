# Responsive — Fase 2 (parcial): Listado de Productos

## Contexto

Primer caso de la Fase 2 general (tablas/listados, sigue pendiente
para el resto: leads, tickets, post-venta, admin, capacitaciones,
historial/cerrados). Se elige Productos como primer caso porque es la
tabla más simple (sin Kanban de por medio, mismo problema ya resuelto
antes en Clientes vía `ClienteSplitView`, ver
`2026-07-16-responsive-clientes-splitview-design.md` — **esa spec ya
está implementada**, el pendiente genérico de `CONTEXTO_PROYECTO.md`
estaba desactualizado, se verificó contra el código real).

Estado actual (código real, revisado):
- `app/pages/productos/index.vue:203-227`: `<table>` de 4 columnas
  (Nombre, SKU, Categoría, Estado), sin ningún tratamiento responsive
  — en 375px fuerza scroll horizontal.
- `app/pages/productos/index.vue:181-186`: input de búsqueda con
  `w-64` fijo dentro de un contenedor `flex flex-wrap gap-2` (el
  contenedor ya envuelve bien, pero el input queda angosto en mobile
  en vez de aprovechar el ancho disponible).
- `app/components/shared/PageHeader.vue:6`: `flex items-center
  justify-between`, **sin `flex-wrap`** — título + botones de acción
  se aprietan/desbordan en pantalla angosta. Este componente lo usa
  casi toda página de listado del proyecto, así que el fix acá
  beneficia a toda la Fase 2, no solo a Productos.
- `app/components/shared/Modal.vue:10-13`: ya es responsive
  (`w-full max-w-sm` + `p-4` en el overlay) — no necesita cambios, se
  confirma explícitamente para no asumir.

## Diseño

### `SharedPageHeader.vue` — fix base

```html
<!-- antes -->
<div class="flex items-center justify-between mb-6">
<!-- después -->
<div class="flex flex-wrap items-center justify-between gap-2 mb-6">
```

En pantalla angosta, el título queda arriba y los botones de acción
bajan a su propia fila en vez de aplastarse. En desktop, sin cambio
visual (`flex-wrap` no actúa cuando todo entra en una fila).

### Filtros — `app/pages/productos/index.vue:181-186`

```html
<!-- antes -->
<input v-model="busqueda" ... class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 ..." />
<!-- después -->
<input v-model="busqueda" ... class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-64 ..." />
```

### Tabla → cards — `app/pages/productos/index.vue:199-228`

Mismo criterio que Kanban/ClienteSplitView: una presentación por
ancho de pantalla, sin duplicar lógica de filtrado (ambas vistas leen
del mismo `productosFiltrados`). La `<table>` se envuelve en
`hidden lg:block overflow-x-auto`; se agrega un listado de cards
`lg:hidden` con el mismo click-to-edit.

```html
<div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
  <div v-if="productosFiltrados.length === 0" class="p-10 text-center text-gray-400">
    {{ busqueda || filtroCategoria || filtroEstado ? 'Sin resultados para estos filtros' : 'Sin productos todavía' }}
  </div>

  <div v-else class="hidden lg:block overflow-x-auto">
    <table class="w-full text-sm">
      <!-- contenido de la tabla actual, sin cambios -->
    </table>
  </div>

  <div v-if="productosFiltrados.length" class="lg:hidden divide-y divide-gray-50">
    <div
      v-for="p in productosFiltrados"
      :key="p.id"
      class="p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100"
      @click="abrirEditar(p)"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="font-medium text-gray-700 truncate">{{ p.nombre }}</span>
        <SharedBadge :label="p.estado === 'activo' ? 'Activo' : 'Inactivo'" :clases="colorEstado[p.estado]" />
      </div>
      <p class="text-xs text-gray-500 mt-1">{{ p.sku }} · {{ p.categoria || '—' }}</p>
    </div>
  </div>
</div>
```

(Se agrega `overflow-x-auto` al wrapper de la tabla desktop como red
de seguridad extra ante categorías/nombres muy largos, aunque en `lg`+
ya no debería hacer falta scrollear.)

## Fuera de alcance

- El resto de la Fase 2 (leads, tickets, post-venta, admin,
  capacitaciones, historial/cerrados) — casos separados, uno a la vez.
- Fase 4 (vistas de detalle multi-columna, modales de formulario
  largos) — no aplica acá, los modales de Productos ya son
  responsive sin cambios.
- No se cambia el contenido de `ProductosProductoForm.vue` dentro del
  modal — mismo formulario, sin importar el ancho de pantalla.
- No se agrega buscador/filtro colapsable en mobile — los 3 controles
  de filtro ya caben apilados con el `flex-wrap` existente.

## Testing (manual, sin suite automatizada)

1. Celular/ventana angosta (<1024px) en `/productos`: el header
   (título + Exportar/Importar/+Nuevo) no se aprieta ni desborda,
   los botones bajan a su propia fila si no entran.
2. Mismo ancho: se ve la lista como cards apiladas (nombre + badge de
   estado arriba, SKU y categoría abajo), no la tabla.
3. Tocar una card: abre el modal de edición, igual que hoy al hacer
   click en una fila de la tabla en desktop.
4. El input de búsqueda ocupa todo el ancho disponible en mobile.
5. Ensanchar a ≥1024px: vuelve la tabla de siempre, cards
   desaparecen, header en una sola fila — sin cambios respecto al
   comportamiento actual.
6. Revisar de pasada 2-3 páginas más que usan `SharedPageHeader`
   (ej. `/clientes`, `/leads`) en mobile — confirmar que el fix del
   `flex-wrap` no rompió nada ahí (cambio compartido, aunque esas
   páginas no son el objetivo de este spec).
