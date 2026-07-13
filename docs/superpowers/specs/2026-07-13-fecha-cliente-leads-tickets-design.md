# Fecha de creación en Leads/Tickets + cliente en la lista de Tickets

## Contexto

Pedido del usuario: en las vistas de listado (Kanban) de leads y tickets,
mostrar la fecha de creación en cada tarjeta, y repetirla también dentro
de la vista de detalle de cada lead y cada ticket. Además, en el listado
de tickets, mostrar también el cliente al que pertenece cada ticket.

Estado actual relevante:
- `Lead` (`useLeads.ts`) y `Ticket` (`useTickets.ts`) ya tienen `created_at:
  string` — no hace falta migración, solo mostrarlo.
- `LeadKanban.vue`: cada tarjeta muestra avatar + nombre (con link a
  `/leads/[id]`) y una segunda línea con teléfono/email.
- `TicketBoard.vue`: cada tarjeta muestra título (con link a `/tickets/[id]`)
  y badge de prioridad. No muestra ningún otro dato.
- `Ticket.cliente_id` es la única referencia al cliente — no viene la razón
  social embebida. `useAuditoria.ts` y `useFeatures.ts` ya usan el patrón de
  select embebido de Supabase (`.select('*, tabla(columnas)')`) para resolver
  esto sin una consulta separada; se reutiliza el mismo patrón acá.
- `SharedPageHeader.vue` expone hoy un slot `#accion` (para botones a la
  derecha del título) pero no hay lugar para un subtítulo.
- `leads/[id].vue` y `tickets/[id].vue` usan `<SharedPageHeader :titulo="..."
  volver-a="...">` con el badge de estado en `#accion`.
- El proyecto ya tiene una función `formatearFecha` duplicada localmente en
  tres componentes (`TareaList.vue`, `NotificationBell.vue`,
  `LeadTimeline.vue`), cada uno con su propio formato según su necesidad
  (con hora en los tres casos, porque son contextos donde la hora importa
  — tareas, notificaciones recientes, timeline de interacciones). Este
  pedido sigue la misma convención de duplicar localmente en vez de crear
  un util compartido nuevo.

## Decisiones de producto (validadas con el usuario)

1. **Formato de fecha: día + mes + año, sin hora** (ej. "12 jul 2026") —
   a diferencia de los `formatearFecha` existentes (que omiten el año
   porque son para eventos recientes), leads y tickets pueden acumularse
   durante meses o años, así que el año es necesario para no generar
   ambigüedad.
2. **En el detalle, la fecha va como subtítulo del `SharedPageHeader`**, no
   dentro de las tarjetas de formulario — se agrega un slot `#subtitulo`
   opcional al componente compartido.
3. **En tickets, el cliente se resuelve vía select embebido** de Supabase
   sobre la relación existente `tickets.cliente_id → clientes.id`, no con
   una consulta separada ni un mapa cliente-por-id construido a mano.
4. **Sin cambios de esquema** — `created_at` ya existe en ambas tablas.

## Diseño

### `useTickets.ts`

`fetchTickets` pasa a traer la razón social del cliente:

```ts
const fetchTickets = async (filtroEstado?: EstadoTicket) => {
  let query = supabase
    .from('tickets')
    .select('*, clientes(razon_social)')
    .order('created_at', { ascending: false })
  if (filtroEstado) query = query.eq('estado', filtroEstado)
  const { data, error } = await query
  if (error) throw error
  return data as unknown as Ticket[]
}
```

(Mismo cast `as unknown as X[]` que ya usa `useAuditoria.ts` para su select
embebido, porque el tipo inferido por supabase-js para un select con
string literal no coincide 1:1 con la interfaz manual.)

`Ticket` gana un campo opcional:

```ts
export interface Ticket {
  id: string
  cliente_id: string
  titulo: string
  descripcion: string | null
  estado: EstadoTicket
  prioridad: PrioridadTicket
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
  clientes?: { razon_social: string } | null
}
```

`getTicket`, `createTicket`, `updateTicket`, `deleteTicket`,
`fetchTicketsPorCliente`, `cambiarEstado`, `asignarTecnico` no cambian —
siguen usando `select('*')` sin el embebido, porque ninguno de esos
contextos necesita mostrar la razón social (el detalle de ticket ya
navegó *desde* un cliente conocido, o no muestra el cliente en absoluto
por ahora — fuera de alcance, ver más abajo).

El widget `KpiTicketsAbiertos.vue` reutiliza `fetchTickets()` sin cambios
en su código — el campo `clientes` nuevo le llega pero no lo usa, sin
impacto (el volumen de tickets no es comparable al de clientes, el select
embebido no agrega un costo apreciable).

### `LeadKanban.vue`

Se agrega una línea con la fecha debajo de la de contacto:

```html
<p class="text-xs text-gray-400 ml-9">{{ lead.telefono || lead.email || 'Sin contacto' }}</p>
<p class="text-[11px] text-gray-300 ml-9 mt-0.5">{{ formatearFecha(lead.created_at) }}</p>
```

Con la función local:

```ts
function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
```

### `TicketBoard.vue`

Se agregan dos líneas debajo del título/badge:

```html
<div class="flex items-start justify-between gap-2 mb-2">
  <NuxtLink :to="`/tickets/${ticket.id}`" class="font-medium text-sm text-gray-800 hover:underline">
    {{ ticket.titulo }}
  </NuxtLink>
  <SharedBadge :label="colorPrioridad(ticket.prioridad).label" :clases="colorPrioridad(ticket.prioridad).clases" />
</div>
<p class="text-xs text-gray-400">{{ ticket.clientes?.razon_social ?? 'Cliente no disponible' }}</p>
<p class="text-[11px] text-gray-300 mt-0.5">{{ formatearFecha(ticket.created_at) }}</p>
```

Mismo `formatearFecha` local (duplicado, igual que en `LeadKanban.vue`).
`ticket.clientes?.razon_social ?? 'Cliente no disponible'` cubre el caso
(hoy inalcanzable, dado que `cliente_id` es `not null` con FK) de que el
select embebido no traiga fila relacionada.

### `SharedPageHeader.vue`

Nuevo slot opcional `#subtitulo`, sin nueva prop (consistente con cómo ya
funciona `#accion`):

```html
<div>
  <NuxtLink v-if="volverA" :to="volverA" class="text-xs text-ink-muted hover:text-primary mb-1 inline-block transition-colors duration-150">
    ← Volver
  </NuxtLink>
  <h1 class="text-xl font-semibold text-ink">{{ titulo }}</h1>
  <p v-if="$slots.subtitulo" class="text-xs text-ink-muted mt-0.5">
    <slot name="subtitulo" />
  </p>
</div>
```

### `leads/[id].vue` y `tickets/[id].vue`

Cada uno agrega su propio `formatearFecha` local (mismo formato que las
tarjetas) y pasa el slot:

```html
<SharedPageHeader :titulo="lead.nombre" volver-a="/leads">
  <template #subtitulo>Creado el {{ formatearFecha(lead.created_at) }}</template>
  <template #accion>
    <SharedBadge :label="colorLead(lead.estado).label" :clases="colorLead(lead.estado).clases" />
  </template>
</SharedPageHeader>
```

Mismo patrón en `tickets/[id].vue` con `ticket.created_at`.

## Fuera de alcance

- No se agrega el cliente a la vista de detalle de ticket (`tickets/[id].vue`)
  — no se pidió; el ticket ya se edita desde `TicketForm.vue`, que sí
  muestra/permite cambiar el cliente vía el buscador ya implementado.
- No se toca `fetchTicketsPorCliente` (usado en `ClienteSplitView.vue`) ni
  `getTicket` — ninguno de esos contextos necesita el embebido.
- No se crea un util compartido de formateo de fecha — se sigue la
  convención existente de duplicar la función localmente por componente
  (ver Contexto).
- No se agrega fecha de creación a `ClienteSplitView.vue` ni a
  `productos/index.vue` — no se pidió, solo leads y tickets.

## Testing (manual, sin suite automatizada)

1. `/leads`: cada tarjeta del Kanban muestra la fecha de creación del lead
   (formato "12 jul 2026") debajo del teléfono/email.
2. `/tickets`: cada tarjeta del Kanban muestra la razón social del cliente
   y la fecha de creación del ticket, debajo del título/prioridad.
3. Abrir un lead (`/leads/[id]`): debajo del título aparece "Creado el
   <fecha>", con el mismo formato.
4. Abrir un ticket (`/tickets/[id]`): mismo subtítulo con la fecha de
   creación del ticket.
5. El widget `KpiTicketsAbiertos` (dashboard) sigue funcionando sin
   cambios visibles — el conteo de tickets abiertos no se ve afectado.
6. Un ticket cuyo cliente fue eliminado (caso hoy inalcanzable por la FK
   `not null`, pero cubierto defensivamente): la tarjeta muestra "Cliente
   no disponible" en vez de romper.
