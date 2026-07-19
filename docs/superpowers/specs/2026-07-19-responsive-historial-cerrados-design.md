# Responsive historial-movimientos / cerrados (6 páginas) — Design Spec

**Fecha:** 2026-07-19

## Contexto

Continuación de la fase 2 responsive. Seis páginas comparten el mismo
esqueleto de tabla simple sin filtros (`<table>` directo, sin la lista
`<ul>`/`<li>` que ya usa Auditoría): `leads/historial-movimientos.vue`,
`leads/cerrados.vue`, `tickets/historial-movimientos.vue`,
`tickets/cerrados.vue`, `post-venta/historial-movimientos.vue`,
`post-venta/cerrados.vue`. Mismo patrón tabla→card que
`docs/superpowers/specs/2026-07-19-responsive-productos-listado-design.md`
(`hidden lg:block overflow-x-auto` en la tabla + `lg:hidden divide-y` en
la lista de cards), aplicado 6 veces.

## Cambios (por archivo)

Cada archivo agrega `hidden lg:block overflow-x-auto` al wrapper de la
`<table>` existente (sin tocar columnas/contenido) y un bloque nuevo
`lg:hidden divide-y divide-gray-50` con una card por fila, mismo texto que
ya muestra la tabla, reacomodado en 2 líneas: nombre/link + badge principal
arriba, resto de campos abajo en `text-xs text-gray-500` separados por
" · ".

**`leads/historial-movimientos.vue`** / **`tickets/historial-movimientos.vue`**
/ **`post-venta/historial-movimientos.vue`** (idéntica estructura, solo
cambia el campo de entidad/ruta/función de color):

```html
<div class="lg:hidden divide-y divide-gray-50">
  <div v-for="f in filas" :key="f.id" class="p-4">
    <div class="flex items-center justify-between gap-2">
      <NuxtLink :to="`/leads/${f.entidad_id}`" class="font-medium text-gray-700 truncate hover:underline">
        {{ f.lead_nombre }}
      </NuxtLink>
      <SharedBadge :label="colorLead(f.estado_nuevo).label" :clases="colorLead(f.estado_nuevo).clases" />
    </div>
    <p class="text-xs text-gray-500 mt-1">
      <span v-if="f.estado_anterior">Desde {{ colorLead(f.estado_anterior).label }} · </span>{{ f.usuario_nombre ?? '—' }} · {{ formatearFechaHora(f.created_at) }}
    </p>
  </div>
</div>
```

(mismo bloque en tickets con `colorTicket`/`f.ticket_titulo`/`/tickets/`, y
en post-venta con `colorTicketPostVenta`/`f.n_guia`/`/post-venta/`.)

**`leads/cerrados.vue`**:

```html
<div class="lg:hidden divide-y divide-gray-50">
  <div
    v-for="l in leads"
    :key="l.id"
    class="p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100"
    @click="navigateTo(`/leads/${l.id}`)"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="font-medium text-gray-700 truncate">{{ l.nombre }}</span>
      <SharedBadge :label="colorLead(l.estado).label" :clases="colorLead(l.estado).clases" />
    </div>
    <p class="text-xs text-gray-500 mt-1">
      {{ formatearFecha(l.fecha_cierre) }} · Archivado: {{ l.archivado ? 'Sí' : 'No (aún visible en el listado activo)' }}
    </p>
  </div>
</div>
```

**`tickets/cerrados.vue`** (agrega Cliente):

```html
<div class="lg:hidden divide-y divide-gray-50">
  <div
    v-for="t in tickets"
    :key="t.id"
    class="p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100"
    @click="navigateTo(`/tickets/${t.id}`)"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="font-medium text-gray-700 truncate">{{ t.titulo }}</span>
      <SharedBadge :label="colorTicket(t.estado).label" :clases="colorTicket(t.estado).clases" />
    </div>
    <p class="text-xs text-gray-500 mt-1">
      {{ t.clientes?.razon_social ?? '—' }} · {{ formatearFecha(t.fecha_cierre) }} · Archivado: {{ t.archivado ? 'Sí' : 'No (aún visible en el listado activo)' }}
    </p>
  </div>
</div>
```

**`post-venta/cerrados.vue`** (sin badge de estado — la tabla tampoco lo
tiene, en cambio Equipo + 2 fechas):

```html
<div class="lg:hidden divide-y divide-gray-50">
  <div
    v-for="t in tickets"
    :key="t.id"
    class="p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100"
    @click="navigateTo(`/post-venta/${t.id}`)"
  >
    <p class="font-medium text-gray-700 truncate">{{ t.n_guia }}</p>
    <p class="text-xs text-gray-500 mt-1">{{ t.cliente_nombre }} · {{ t.producto_nombre }}</p>
    <p class="text-xs text-gray-500 mt-0.5">
      Despacho {{ formatearFecha(t.fecha_despacho) }} · Cierre {{ formatearFecha(t.fecha_cierre) }} · Archivado: {{ t.archivado ? 'Sí' : 'No (aún visible en el listado activo)' }}
    </p>
  </div>
</div>
```

## Alcance

Solo estos 6 archivos, solo el wrapper de la tabla (agregar `hidden
lg:block overflow-x-auto`) + el bloque `lg:hidden` nuevo. No toca
composables, columnas de la tabla desktop, ni el texto mostrado (mismo
copy, solo reacomodado).

## Testing

`npm run build` una vez al final (los 6 cambios son mecánicos y del mismo
tipo) + verificación manual (usuario) en pantalla angosta en al menos una
de las 6.
