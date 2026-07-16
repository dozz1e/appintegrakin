# Responsive — Fase 3: Kanban de leads/tickets/post-venta

## Contexto

Fase 2 (tablas/listados) queda pendiente para después; el usuario pidió
priorizar los Kanban porque "las vistas de los estados de los tickets y
leads no se ven bien" en celular. Hay tres componentes casi idénticos:
`app/components/leads/LeadKanban.vue` (6 columnas), `app/components/
tickets/TicketBoard.vue` (5 columnas), `app/components/post-venta/
TicketBoard.vue` (7 columnas).

Estado actual (los tres, mismo patrón exacto):
```html
<div class="grid grid-cols-N gap-3 overflow-x-auto">
  <div v-for="col in columnas" class="min-w-[190px] rounded-lg p-3" ...>
    <h3>{{ col.titulo }} <span>{{ count }}</span></h3>
    <draggable v-model="grupos[col.estado]" group="..." @change="...">
      <template #item="{ element }"> ...tarjeta... </template>
    </draggable>
  </div>
</div>
```
`grid-cols-N` + `min-w-[190px]` son fijos, sin variantes `lg:`/`md:` —
en un celular real (~375-430px) solo entran ~2 columnas cortadas a la
mitad, sin indicio visual de que hay más para el lado. Ya existe
`overflow-x-auto` pero eso no alcanza a esos anchos.

Confirmado en el código: `onDragChange` solo emite `cambiar-estado`
cuando `evt.added` es verdadero (la tarjeta cruzó a otra columna) — **el
reordenamiento dentro de la misma columna no se persiste en ningún
lado** (no existe columna `orden` en `leads`/`tickets`/
`tickets_post_venta`), es puramente visual y se resetea al recargar.
Esto habilita simplificar: en mobile no hace falta drag-and-drop en
absoluto, ya que lo único que el drag persiste de verdad es el cambio
de estado.

## Diseño

**Decisión de producto (validada con el usuario): en mobile, una
columna a la vez con tabs arriba (no scroll-snap de columnas anchas).**
Para cambiar de estado una tarjeta en mobile, un `<select>` "Mover a"
en la tarjeta (reemplaza el drag-and-drop, que solo servía para eso).
En `lg` (1024px) y para arriba, cero cambios — mismo grid + drag-and-drop
de siempre.

Mismo cambio en los tres componentes (`LeadKanban.vue`, `tickets/
TicketBoard.vue`, `post-venta/TicketBoard.vue`), en espejo, sin
abstraer un componente compartido (los tres ya están duplicados a
propósito, mismo criterio del resto del proyecto — YAGNI, no
refactorizar lo que no se está tocando por otra razón).

### Estado nuevo por componente

```ts
const tabActiva = ref<EstadoLead>(columnas[0].estado)  // o EstadoTicket / EstadoTicketPostVenta
```

### Template — reemplazar el `<div class="grid grid-cols-N ...">` raíz

El grid de desktop se envuelve en `hidden lg:grid` (nada más cambia
adentro). Se agregan, antes de ese div, las tabs (`lg:hidden`) y,
después, la lista mobile de una sola columna (`lg:hidden`):

```html
<!-- Tabs (mobile/tablet, oculto en lg+) -->
<div class="lg:hidden flex gap-2 overflow-x-auto pb-1 mb-3">
  <button
    v-for="col in columnas"
    :key="col.estado"
    type="button"
    class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
    :class="tabActiva === col.estado
      ? colorLead(col.estado).clases.split(' ')[1].replace('text-', 'bg-') + ' text-white'
      : 'bg-gray-100 text-gray-600'"
    @click="tabActiva = col.estado"
  >
    {{ col.titulo }} ({{ grupos[col.estado]?.length ?? 0 }})
  </button>
</div>

<!-- Lista mobile: una sola columna, sin drag -->
<div class="lg:hidden space-y-2">
  <div
    v-for="lead in grupos[tabActiva]"
    :key="lead.id"
    class="border border-gray-100 rounded-xl p-3 bg-white shadow-sm"
  >
    <!-- mismo contenido de tarjeta que ya existe -->
    ...
    <select
      :value="lead.estado"
      class="mt-2 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-ring"
      @change="$emit('cambiar-estado', lead.id, ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="c in columnas" :key="c.estado" :value="c.estado">Mover a: {{ c.titulo }}</option>
    </select>
  </div>
  <p v-if="!grupos[tabActiva]?.length" class="text-sm text-gray-400 text-center py-6">
    Sin elementos en este estado.
  </p>
</div>

<!-- Grid desktop: sin cambios adentro, solo se agrega hidden lg:grid -->
<div class="hidden lg:grid lg:grid-cols-N gap-3 overflow-x-auto">
  ...
</div>
```

Notas sobre el color de las tabs: `colorLead(col.estado).clases` ya
trae dos clases (fondo suave + texto), pero para la tab activa
queremos un fondo sólido con texto blanco en vez del fondo suave que
usan las columnas — de ahí el `.replace('text-', 'bg-')` sobre la clase
de texto (mismo truco ya usado en otras partes del código para derivar
un color de borde a partir de uno de texto, ver `ClienteInteraccionTimeline.vue`).
Si el resultado visual no convence en la revisión manual, es un detalle
de estilo ajustable sin tocar la lógica.

El contenido de cada tarjeta en la lista mobile es una copia del que ya
existe dentro de `<template #item>` (mismo layout de nombre/cliente/
fecha/badge por componente) — se duplica porque cada Kanban ya tiene su
propio layout de tarjeta distinto, no se extrae un componente
compartido (ver "Fuera de alcance").

## Fuera de alcance

- No se abstrae un componente `KanbanBase`/`TarjetaBase` compartido
  entre los tres — se duplica el patrón, igual que ya están duplicados
  hoy los tres archivos completos.
- No se persiste el orden dentro de una columna (nunca se persistió,
  ni en desktop) — el "mover a" en mobile solo cambia `estado`.
- Fase 2 (tablas/listados) sigue pendiente, no se toca en esta fase.
- No se agrega swipe-gesture para cambiar de tab (solo tocar el botón
  de la tab).

## Testing (manual, sin suite automatizada)

1. Celular/ventana angosta (<1024px) en `/leads`: se ven tabs arriba
   (Nuevo/Contactado/.../Perdido) con contador, y debajo la lista de la
   tab activa, sin grid ni drag.
2. Tocar otra tab: cambia la lista mostrada.
3. Usar el `<select>` "Mover a" de una tarjeta: el lead cambia de
   estado (recargar la página o cambiar de tab y volver confirma que
   persistió).
4. Repetir 1-3 en `/tickets` y `/post-venta`.
5. Ensanchar a ≥1024px: vuelve el grid de columnas con drag-and-drop de
   siempre, sin tabs ni lista mobile visibles.
6. Estado vacío: una tab sin elementos muestra "Sin elementos en este
   estado" en vez de una lista vacía en blanco.
