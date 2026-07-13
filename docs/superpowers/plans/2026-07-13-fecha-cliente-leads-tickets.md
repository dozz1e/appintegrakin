# Fecha de creación en Leads/Tickets + cliente en la lista de Tickets — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar la fecha de creación en las tarjetas Kanban de leads y tickets (y en la vista de detalle de cada uno), y mostrar también el cliente en las tarjetas de tickets.

**Architecture:** `useTickets.ts` resuelve el cliente vía select embebido de Supabase (mismo patrón que `useAuditoria.ts`/`useFeatures.ts`), sin consulta separada. `LeadKanban.vue`/`TicketBoard.vue` ganan una función local `formatearFecha` (duplicada, siguiendo la convención ya existente en el repo) y una o dos líneas nuevas por tarjeta. `SharedPageHeader.vue` gana un slot opcional `#subtitulo`, consumido por `leads/[id].vue` y `tickets/[id].vue` para mostrar "Creado el <fecha>".

**Tech Stack:** Nuxt 4 / Vue 3 `<script setup>` con TypeScript, Supabase JS (select embebido sobre relación FK), Tailwind (clases hex directas, mismo estilo que el resto de `app/components/leads/`, `app/components/tickets/` y `app/components/shared/`).

## Global Constraints

- Sin suite de tests automatizada (`package.json` no tiene script `test`) — verificación de cada tarea: `npm run build` (o `rm -rf .nuxt && npm run build` para cambios en componentes/slots) más una verificación manual descrita en cada tarea.
- Formato de fecha en todo este plan: `día mes año`, sin hora — `new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })` (ej. "12 jul 2026"). Este formato es distinto al de los `formatearFecha` ya existentes en el repo (que omiten el año) — no reutilizar esos, escribir uno nuevo local en cada archivo que lo necesite (decisión explícita del spec, ver `docs/superpowers/specs/2026-07-13-fecha-cliente-leads-tickets-design.md`, sección "Duplicación intencional").
- No crear ningún util compartido de formateo de fecha.
- No tocar `fetchTicketsPorCliente`, `getTicket`, ni ninguna otra función de `useTickets.ts` fuera de `fetchTickets`.

---

### Task 1: Select embebido de cliente en `useTickets.ts`

**Files:**
- Modify: `app/composables/useTickets.ts:6-18` (interfaz `Ticket`) y `app/composables/useTickets.ts:23-29` (función `fetchTickets`)

**Interfaces:**
- Consumes: nada nuevo — `useSupabaseClient()` ya usado en el resto del archivo.
- Produces: `Ticket.clientes?: { razon_social: string } | null` (campo nuevo en la interfaz ya existente) y `fetchTickets()` devolviendo tickets con ese campo poblado. Task 3 (`TicketBoard.vue`) consume `ticket.clientes?.razon_social`.

- [ ] **Step 1: Agregar el campo `clientes` a la interfaz `Ticket`**

En `app/composables/useTickets.ts`, la interfaz actual es:

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
}
```

Reemplazarla por:

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

- [ ] **Step 2: Traer la razón social en `fetchTickets`**

La función actual es:

```ts
  const fetchTickets = async (filtroEstado?: EstadoTicket) => {
    let query = supabase.from('tickets').select('*').order('created_at', { ascending: false })
    if (filtroEstado) query = query.eq('estado', filtroEstado)
    const { data, error } = await query
    if (error) throw error
    return data as Ticket[]
  }
```

Reemplazarla por:

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

(El cast pasa de `as Ticket[]` a `as unknown as Ticket[]` porque el tipo que infiere supabase-js para un select con string literal no coincide 1:1 con la interfaz manual — mismo patrón que ya usa `fetchAuditoria` en `useAuditoria.ts`.)

No tocar `fetchTicketsPorCliente`, `getTicket`, `createTicket`, `updateTicket`, `deleteTicket`, `cambiarEstado`, `asignarTecnico` — siguen usando `select('*')` sin el embebido.

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: termina sin errores (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add app/composables/useTickets.ts
git commit -m "$(cat <<'EOF'
Traer razón social del cliente en fetchTickets

Select embebido sobre la relación tickets.cliente_id -> clientes.id,
mismo patrón que useAuditoria.ts/useFeatures.ts - ver
docs/superpowers/specs/2026-07-13-fecha-cliente-leads-tickets-design.md
EOF
)"
```

---

### Task 2: Fecha de creación en las tarjetas de `LeadKanban.vue`

**Files:**
- Modify: `app/components/leads/LeadKanban.vue`

**Interfaces:**
- Consumes: `Lead.created_at: string` (ya existe en `~/composables/useLeads`, sin cambios).
- Produces: ninguna interfaz nueva — cambio puramente visual dentro del componente.

- [ ] **Step 1: Agregar `formatearFecha` y la línea de fecha en la tarjeta**

En `app/components/leads/LeadKanban.vue`, el `<script setup>` termina así:

```ts
function onDragChange(evt: any, estadoDestino: EstadoLead) {
  if (evt.added) {
    const lead = evt.added.element as Lead
    emit('cambiar-estado', lead.id, estadoDestino)
  }
}
</script>
```

Agregar la función `formatearFecha` antes del cierre del `</script>`:

```ts
function onDragChange(evt: any, estadoDestino: EstadoLead) {
  if (evt.added) {
    const lead = evt.added.element as Lead
    emit('cambiar-estado', lead.id, estadoDestino)
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>
```

En el `<template>`, la tarjeta actual es:

```html
          <div class="border border-gray-100 rounded-xl p-3 bg-white shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
            <div class="flex items-center gap-2 mb-1">
              <SharedAvatar :nombre="lead.nombre" size="sm" />
              <NuxtLink :to="`/leads/${lead.id}`" class="font-medium text-sm text-gray-800 hover:underline">
                {{ lead.nombre }}
              </NuxtLink>
            </div>
            <p class="text-xs text-gray-400 ml-9">{{ lead.telefono || lead.email || 'Sin contacto' }}</p>
          </div>
```

Reemplazarla por:

```html
          <div class="border border-gray-100 rounded-xl p-3 bg-white shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
            <div class="flex items-center gap-2 mb-1">
              <SharedAvatar :nombre="lead.nombre" size="sm" />
              <NuxtLink :to="`/leads/${lead.id}`" class="font-medium text-sm text-gray-800 hover:underline">
                {{ lead.nombre }}
              </NuxtLink>
            </div>
            <p class="text-xs text-gray-400 ml-9">{{ lead.telefono || lead.email || 'Sin contacto' }}</p>
            <p class="text-[11px] text-gray-300 ml-9 mt-0.5">{{ formatearFecha(lead.created_at) }}</p>
          </div>
```

- [ ] **Step 2: Verificar que compila**

Run: `rm -rf .nuxt && npm run build`
Expected: termina sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/components/leads/LeadKanban.vue
git commit -m "$(cat <<'EOF'
Mostrar fecha de creación en las tarjetas de leads

Ver docs/superpowers/specs/2026-07-13-fecha-cliente-leads-tickets-design.md
EOF
)"
```

---

### Task 3: Cliente y fecha de creación en las tarjetas de `TicketBoard.vue`

**Files:**
- Modify: `app/components/tickets/TicketBoard.vue`

**Interfaces:**
- Consumes: `Ticket.clientes?: { razon_social: string } | null` y `Ticket.created_at: string` (Task 1, ya en `~/composables/useTickets`).
- Produces: ninguna interfaz nueva — cambio puramente visual.

- [ ] **Step 1: Agregar `formatearFecha` y las líneas de cliente/fecha en la tarjeta**

En `app/components/tickets/TicketBoard.vue`, el `<script setup>` termina así:

```ts
function onDragChange(evt: any, estadoDestino: EstadoTicket) {
  if (evt.added) {
    const ticket = evt.added.element as Ticket
    emit('cambiar-estado', ticket.id, estadoDestino)
  }
}
</script>
```

Agregar la función `formatearFecha`:

```ts
function onDragChange(evt: any, estadoDestino: EstadoTicket) {
  if (evt.added) {
    const ticket = evt.added.element as Ticket
    emit('cambiar-estado', ticket.id, estadoDestino)
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>
```

En el `<template>`, la tarjeta actual es:

```html
          <div class="border border-gray-100 rounded-xl p-3 bg-white shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between gap-2 mb-2">
              <NuxtLink :to="`/tickets/${ticket.id}`" class="font-medium text-sm text-gray-800 hover:underline">
                {{ ticket.titulo }}
              </NuxtLink>
              <SharedBadge :label="colorPrioridad(ticket.prioridad).label" :clases="colorPrioridad(ticket.prioridad).clases" />
            </div>
          </div>
```

Reemplazarla por:

```html
          <div class="border border-gray-100 rounded-xl p-3 bg-white shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between gap-2 mb-2">
              <NuxtLink :to="`/tickets/${ticket.id}`" class="font-medium text-sm text-gray-800 hover:underline">
                {{ ticket.titulo }}
              </NuxtLink>
              <SharedBadge :label="colorPrioridad(ticket.prioridad).label" :clases="colorPrioridad(ticket.prioridad).clases" />
            </div>
            <p class="text-xs text-gray-400">{{ ticket.clientes?.razon_social ?? 'Cliente no disponible' }}</p>
            <p class="text-[11px] text-gray-300 mt-0.5">{{ formatearFecha(ticket.created_at) }}</p>
          </div>
```

- [ ] **Step 2: Verificar que compila**

Run: `rm -rf .nuxt && npm run build`
Expected: termina sin errores.

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`, iniciar sesión, abrir `/tickets`. Cada tarjeta debe mostrar la razón social del cliente y la fecha de creación debajo del título/prioridad. Si algún ticket muestra "Cliente no disponible", eso indicaría un `cliente_id` sin fila relacionada en `clientes` — reportarlo como hallazgo, no es un bug del componente (la FK `not null` de `tickets.cliente_id` hace que esto no debería ocurrir en datos reales).

- [ ] **Step 4: Commit**

```bash
git add app/components/tickets/TicketBoard.vue
git commit -m "$(cat <<'EOF'
Mostrar cliente y fecha de creación en las tarjetas de tickets

Ver docs/superpowers/specs/2026-07-13-fecha-cliente-leads-tickets-design.md
EOF
)"
```

---

### Task 4: Slot `#subtitulo` en `SharedPageHeader.vue`

**Files:**
- Modify: `app/components/shared/PageHeader.vue`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: slot nombrado opcional `#subtitulo` en `<SharedPageHeader>`. Task 5 lo consume en `leads/[id].vue` y `tickets/[id].vue`. El slot es opt-in (no rompe ningún uso existente de `<SharedPageHeader>` en el resto de la app, que simplemente no lo declaran).

- [ ] **Step 1: Agregar el slot**

El archivo completo actual es:

```vue
<script setup lang="ts">
defineProps<{ titulo: string; volverA?: string }>()
</script>

<template>
  <div class="flex items-center justify-between mb-6">
    <div>
      <NuxtLink
        v-if="volverA"
        :to="volverA"
        class="text-xs text-ink-muted hover:text-primary mb-1 inline-block transition-colors duration-150"
      >
        ← Volver
      </NuxtLink>
      <h1 class="text-xl font-semibold text-ink">{{ titulo }}</h1>
    </div>
    <slot name="accion" />
  </div>
</template>
```

Reemplazarlo por:

```vue
<script setup lang="ts">
defineProps<{ titulo: string; volverA?: string }>()
</script>

<template>
  <div class="flex items-center justify-between mb-6">
    <div>
      <NuxtLink
        v-if="volverA"
        :to="volverA"
        class="text-xs text-ink-muted hover:text-primary mb-1 inline-block transition-colors duration-150"
      >
        ← Volver
      </NuxtLink>
      <h1 class="text-xl font-semibold text-ink">{{ titulo }}</h1>
      <p v-if="$slots.subtitulo" class="text-xs text-ink-muted mt-0.5">
        <slot name="subtitulo" />
      </p>
    </div>
    <slot name="accion" />
  </div>
</template>
```

- [ ] **Step 2: Verificar que compila**

Run: `rm -rf .nuxt && npm run build`
Expected: termina sin errores.

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`, abrir cualquier página que ya use `<SharedPageHeader>` sin `#subtitulo` (ej. `/leads`, `/tickets`, `/clientes`) — deben verse exactamente igual que antes (el `v-if="$slots.subtitulo"` hace que no aparezca nada si el slot no se usa).

- [ ] **Step 4: Commit**

```bash
git add app/components/shared/PageHeader.vue
git commit -m "$(cat <<'EOF'
Agregar slot #subtitulo opcional a SharedPageHeader

Ver docs/superpowers/specs/2026-07-13-fecha-cliente-leads-tickets-design.md
EOF
)"
```

---

### Task 5: Fecha de creación en el detalle de Lead y de Ticket

**Files:**
- Modify: `app/pages/leads/[id].vue`
- Modify: `app/pages/tickets/[id].vue`

**Interfaces:**
- Consumes: `<SharedPageHeader>`'s `#subtitulo` slot (Task 4), `Lead.created_at`/`Ticket.created_at` (ya existentes).
- Produces: ninguna interfaz nueva — cambio puramente visual en ambas páginas.

- [ ] **Step 1: `leads/[id].vue` — agregar `formatearFecha` y el subtítulo**

El `<script setup>` de `app/pages/leads/[id].vue` termina así (antes del `</script>`):

```ts
async function onConfirmarEliminar() {
  if (!lead.value) return
  eliminando.value = true
  try {
    await deleteLead(lead.value.id)
    success('Lead eliminado')
    await router.push('/leads')
  } catch (e) {
    error('No se pudo eliminar el lead. Intenta de nuevo.')
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}
</script>
```

Agregar `formatearFecha`:

```ts
async function onConfirmarEliminar() {
  if (!lead.value) return
  eliminando.value = true
  try {
    await deleteLead(lead.value.id)
    success('Lead eliminado')
    await router.push('/leads')
  } catch (e) {
    error('No se pudo eliminar el lead. Intenta de nuevo.')
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>
```

En el `<template>`, el `<SharedPageHeader>` actual es:

```html
      <SharedPageHeader :titulo="lead.nombre" volver-a="/leads">
        <template #accion>
          <SharedBadge :label="colorLead(lead.estado).label" :clases="colorLead(lead.estado).clases" />
        </template>
      </SharedPageHeader>
```

Reemplazarlo por:

```html
      <SharedPageHeader :titulo="lead.nombre" volver-a="/leads">
        <template #subtitulo>Creado el {{ formatearFecha(lead.created_at) }}</template>
        <template #accion>
          <SharedBadge :label="colorLead(lead.estado).label" :clases="colorLead(lead.estado).clases" />
        </template>
      </SharedPageHeader>
```

- [ ] **Step 2: `tickets/[id].vue` — agregar `formatearFecha` y el subtítulo**

El `<script setup>` de `app/pages/tickets/[id].vue` termina así (antes del `</script>`):

```ts
async function onConfirmarEliminar() {
  if (!ticket.value) return
  eliminando.value = true
  try {
    await deleteTicket(ticket.value.id)
    success('Ticket eliminado')
    await navigateTo('/tickets')
  } catch (e) {
    error('No se pudo eliminar el ticket. Intenta de nuevo.')
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}
</script>
```

Agregar `formatearFecha`:

```ts
async function onConfirmarEliminar() {
  if (!ticket.value) return
  eliminando.value = true
  try {
    await deleteTicket(ticket.value.id)
    success('Ticket eliminado')
    await navigateTo('/tickets')
  } catch (e) {
    error('No se pudo eliminar el ticket. Intenta de nuevo.')
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>
```

En el `<template>`, el `<SharedPageHeader>` actual es:

```html
      <SharedPageHeader :titulo="ticket.titulo" volver-a="/tickets">
        <template #accion>
          <SharedBadge :label="colorTicket(ticket.estado).label" :clases="colorTicket(ticket.estado).clases" />
        </template>
      </SharedPageHeader>
```

Reemplazarlo por:

```html
      <SharedPageHeader :titulo="ticket.titulo" volver-a="/tickets">
        <template #subtitulo>Creado el {{ formatearFecha(ticket.created_at) }}</template>
        <template #accion>
          <SharedBadge :label="colorTicket(ticket.estado).label" :clases="colorTicket(ticket.estado).clases" />
        </template>
      </SharedPageHeader>
```

- [ ] **Step 3: Verificar que compila**

Run: `rm -rf .nuxt && npm run build`
Expected: termina sin errores.

- [ ] **Step 4: Verificación manual**

Run: `npm run dev`, iniciar sesión:
1. Abrir un lead cualquiera en `/leads/[id]` — debajo del nombre debe verse "Creado el <fecha>" con formato "12 jul 2026".
2. Abrir un ticket cualquiera en `/tickets/[id]` — mismo subtítulo con la fecha de creación del ticket.
3. Confirmar que el resto de la página (formulario, tarjetas laterales, badge de estado) se ve igual que antes.

- [ ] **Step 5: Commit**

```bash
git add app/pages/leads/[id].vue app/pages/tickets/[id].vue
git commit -m "$(cat <<'EOF'
Mostrar fecha de creación en el detalle de lead y ticket

Ver docs/superpowers/specs/2026-07-13-fecha-cliente-leads-tickets-design.md
EOF
)"
```

---

## Cierre

Al terminar las 5 tareas, confirmar con `git log --oneline -6` que quedaron los 5 commits (más el del spec ya existente) y avisarle al usuario que confirme el push a `origin/master` (este entorno no tiene credenciales para pushear solo).
