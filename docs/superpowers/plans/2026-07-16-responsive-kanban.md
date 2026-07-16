# Responsive Fase 3: Kanban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En mobile (<1024px), los tres Kanban (leads/tickets/post-venta) muestran tabs por estado + lista de una sola columna con un `<select>` "Mover a" en vez de drag-and-drop. En `lg` (1024px) y para arriba, sin cambios.

**Architecture:** Mismo cambio en espejo en los tres componentes, sin componente compartido nuevo (ver spec, "Fuera de alcance": ya están duplicados a propósito). El grid de desktop existente se envuelve en `hidden lg:grid`; se agregan tabs + lista mobile, ambas `lg:hidden`, antes del grid.

**Tech Stack:** Nuxt 4 / Vue 3 / TypeScript, Tailwind, `vuedraggable` (sin cambios, sigue usándose solo en el grid desktop).

## Global Constraints

- Sin componente `KanbanBase` compartido — duplicar en los tres archivos (spec, "Fuera de alcance").
- El reordenamiento dentro de una columna nunca se persistió (confirmado: `onDragChange` solo emite en `evt.added`) — el "mover a" mobile solo cambia `estado`, no hay drag en mobile.
- Para el color de la tab activa: usar `colorX(col.estado).clases` completo (ambas clases, `bg-X-bg text-X-text`) — **no** intentar derivar un `bg-` a partir de la clase de texto con `.replace()`, esas clases (`bg-success-text`, etc.) no existen en el sistema de tokens (ver `app/utils/estadoColores.ts`).
- Sin suite de tests automatizada — verificación manual, la hace el usuario.

---

### Task 1: `LeadKanban.vue` responsive

**Files:**
- Modify: `app/components/leads/LeadKanban.vue`

**Interfaces:** Ninguna nueva — mismo `emit('cambiar-estado', id, estado)` ya existente, ahora también disparado desde el `<select>` mobile.

- [ ] **Step 1: Agregar el estado `tabActiva`**

Agregar después de la declaración de `columnas` (línea 15):

```ts
const tabActiva = ref<EstadoLead>(columnas[0].estado)
```

- [ ] **Step 2: Envolver el grid desktop y agregar tabs + lista mobile**

Reemplazar todo el `<template>` (líneas 42-79) por:

```html
<template>
  <div>
    <div class="lg:hidden flex gap-2 overflow-x-auto pb-1 mb-3">
      <button
        v-for="col in columnas"
        :key="col.estado"
        type="button"
        class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
        :class="tabActiva === col.estado ? colorLead(col.estado).clases : 'bg-gray-100 text-gray-500'"
        @click="tabActiva = col.estado"
      >
        {{ col.titulo }} ({{ grupos[col.estado]?.length ?? 0 }})
      </button>
    </div>

    <div class="lg:hidden space-y-2">
      <div
        v-for="lead in grupos[tabActiva]"
        :key="lead.id"
        class="border border-gray-100 rounded-xl p-3 bg-white shadow-sm"
      >
        <div class="flex items-center gap-2 mb-1">
          <SharedAvatar :nombre="lead.nombre" size="sm" />
          <NuxtLink :to="`/leads/${lead.id}`" class="font-medium text-sm text-gray-800 hover:underline">
            {{ lead.nombre }}
          </NuxtLink>
        </div>
        <p class="text-xs text-gray-400 ml-9">{{ lead.telefono || lead.email || 'Sin contacto' }}</p>
        <p class="text-[11px] text-gray-500 ml-9 mt-0.5">{{ formatearFecha(lead.created_at) }}</p>
        <select
          :value="lead.estado"
          class="mt-2 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-ring"
          @change="$emit('cambiar-estado', lead.id, ($event.target as HTMLSelectElement).value as EstadoLead)"
        >
          <option v-for="c in columnas" :key="c.estado" :value="c.estado">Mover a: {{ c.titulo }}</option>
        </select>
      </div>
      <p v-if="!grupos[tabActiva]?.length" class="text-sm text-gray-400 text-center py-6">
        Sin elementos en este estado.
      </p>
    </div>

    <div class="hidden lg:grid lg:grid-cols-6 gap-3 overflow-x-auto">
      <div
        v-for="col in columnas"
        :key="col.estado"
        class="min-w-[190px] rounded-lg p-3"
        :class="colorLead(col.estado).clases.split(' ')[0]"
      >
        <h3
          class="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center justify-between"
          :class="colorLead(col.estado).clases.split(' ')[1]"
        >
          {{ col.titulo }}
          <span class="opacity-60">{{ grupos[col.estado]?.length ?? 0 }}</span>
        </h3>

        <draggable
          v-model="grupos[col.estado]"
          group="leads"
          item-key="id"
          class="space-y-2 min-h-[80px]"
          @change="(evt) => onDragChange(evt, col.estado)"
        >
          <template #item="{ element: lead }">
            <div class="border border-gray-100 rounded-xl p-3 bg-white shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
              <div class="flex items-center gap-2 mb-1">
                <SharedAvatar :nombre="lead.nombre" size="sm" />
                <NuxtLink :to="`/leads/${lead.id}`" class="font-medium text-sm text-gray-800 hover:underline">
                  {{ lead.nombre }}
                </NuxtLink>
              </div>
              <p class="text-xs text-gray-400 ml-9">{{ lead.telefono || lead.email || 'Sin contacto' }}</p>
              <p class="text-[11px] text-gray-500 ml-9 mt-0.5">{{ formatearFecha(lead.created_at) }}</p>
            </div>
          </template>
        </draggable>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Build de verificación**

```bash
rm -rf .nuxt .output && npm run build 2>&1 | tail -20
```

Expected: `✨ Build complete!`.

- [ ] **Step 4: Commit**

```bash
git add app/components/leads/LeadKanban.vue
git commit -m "feat: LeadKanban responsive (tabs + lista mobile, grid en lg+)"
```

---

### Task 2: `tickets/TicketBoard.vue` responsive

**Files:**
- Modify: `app/components/tickets/TicketBoard.vue`

**Interfaces:** Ninguna nueva — mismo `emit('cambiar-estado', id, estado)`.

- [ ] **Step 1: Agregar el estado `tabActiva`**

Agregar después de la declaración de `columnas` (línea 14):

```ts
const tabActiva = ref<EstadoTicket>(columnas[0].estado)
```

- [ ] **Step 2: Envolver el grid desktop y agregar tabs + lista mobile**

Reemplazar todo el `<template>` (líneas 41-79) por:

```html
<template>
  <div>
    <div class="lg:hidden flex gap-2 overflow-x-auto pb-1 mb-3">
      <button
        v-for="col in columnas"
        :key="col.estado"
        type="button"
        class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
        :class="tabActiva === col.estado ? colorTicket(col.estado).clases : 'bg-gray-100 text-gray-500'"
        @click="tabActiva = col.estado"
      >
        {{ col.titulo }} ({{ grupos[col.estado]?.length ?? 0 }})
      </button>
    </div>

    <div class="lg:hidden space-y-2">
      <div
        v-for="ticket in grupos[tabActiva]"
        :key="ticket.id"
        class="border border-gray-100 rounded-xl p-3 bg-white shadow-sm"
      >
        <div class="flex items-start justify-between gap-2 mb-2">
          <NuxtLink :to="`/tickets/${ticket.id}`" class="font-medium text-sm text-gray-800 hover:underline">
            {{ ticket.titulo }}
          </NuxtLink>
          <SharedBadge :label="colorPrioridad(ticket.prioridad).label" :clases="colorPrioridad(ticket.prioridad).clases" />
        </div>
        <p class="text-xs text-gray-400">{{ ticket.clientes?.razon_social ?? 'Cliente no disponible' }}</p>
        <p class="text-[11px] text-gray-500 mt-0.5">{{ formatearFecha(ticket.created_at) }}</p>
        <select
          :value="ticket.estado"
          class="mt-2 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-ring"
          @change="$emit('cambiar-estado', ticket.id, ($event.target as HTMLSelectElement).value as EstadoTicket)"
        >
          <option v-for="c in columnas" :key="c.estado" :value="c.estado">Mover a: {{ c.titulo }}</option>
        </select>
      </div>
      <p v-if="!grupos[tabActiva]?.length" class="text-sm text-gray-400 text-center py-6">
        Sin elementos en este estado.
      </p>
    </div>

    <div class="hidden lg:grid lg:grid-cols-5 gap-3 overflow-x-auto">
      <div
        v-for="col in columnas"
        :key="col.estado"
        class="min-w-[190px] rounded-lg p-3"
        :class="colorTicket(col.estado).clases.split(' ')[0]"
      >
        <h3
          class="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center justify-between"
          :class="colorTicket(col.estado).clases.split(' ')[1]"
        >
          {{ col.titulo }}
          <span class="opacity-60">{{ grupos[col.estado]?.length ?? 0 }}</span>
        </h3>

        <draggable
          v-model="grupos[col.estado]"
          group="tickets"
          item-key="id"
          class="space-y-2 min-h-[80px]"
          @change="(evt) => onDragChange(evt, col.estado)"
        >
          <template #item="{ element: ticket }">
            <div class="border border-gray-100 rounded-xl p-3 bg-white shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
              <div class="flex items-start justify-between gap-2 mb-2">
                <NuxtLink :to="`/tickets/${ticket.id}`" class="font-medium text-sm text-gray-800 hover:underline">
                  {{ ticket.titulo }}
                </NuxtLink>
                <SharedBadge :label="colorPrioridad(ticket.prioridad).label" :clases="colorPrioridad(ticket.prioridad).clases" />
              </div>
              <p class="text-xs text-gray-400">{{ ticket.clientes?.razon_social ?? 'Cliente no disponible' }}</p>
              <p class="text-[11px] text-gray-500 mt-0.5">{{ formatearFecha(ticket.created_at) }}</p>
            </div>
          </template>
        </draggable>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Build de verificación**

```bash
rm -rf .nuxt .output && npm run build 2>&1 | tail -20
```

Expected: `✨ Build complete!`.

- [ ] **Step 4: Commit**

```bash
git add app/components/tickets/TicketBoard.vue
git commit -m "feat: TicketBoard (servicio técnico) responsive (tabs + lista mobile, grid en lg+)"
```

---

### Task 3: `post-venta/TicketBoard.vue` responsive

**Files:**
- Modify: `app/components/post-venta/TicketBoard.vue`

**Interfaces:** Ninguna nueva — mismo `emit('cambiar-estado', id, estado)`.

- [ ] **Step 1: Agregar el estado `tabActiva`**

Agregar después de la declaración de `columnas` (línea 17):

```ts
const tabActiva = ref<EstadoTicketPostVenta>(columnas[0].estado)
```

- [ ] **Step 2: Envolver el grid desktop y agregar tabs + lista mobile**

Reemplazar todo el `<template>` (líneas 49-90) por:

```html
<template>
  <div>
    <div class="lg:hidden flex gap-2 overflow-x-auto pb-1 mb-3">
      <button
        v-for="col in columnas"
        :key="col.estado"
        type="button"
        class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
        :class="tabActiva === col.estado ? colorTicketPostVenta(col.estado).clases : 'bg-gray-100 text-gray-500'"
        @click="tabActiva = col.estado"
      >
        {{ col.titulo }} ({{ grupos[col.estado]?.length ?? 0 }})
      </button>
    </div>

    <div class="lg:hidden space-y-2">
      <div
        v-for="ticket in grupos[tabActiva]"
        :key="ticket.id"
        class="border border-gray-100 rounded-xl p-3 bg-white shadow-sm"
      >
        <div class="flex items-start justify-between gap-2 mb-2">
          <NuxtLink :to="`/post-venta/${ticket.id}`" class="font-medium text-sm text-gray-800 hover:underline">
            {{ ticket.n_guia }}
          </NuxtLink>
          <span v-if="esVencido(ticket)" class="text-xs text-red-600 font-medium">vencido</span>
        </div>
        <p class="text-xs text-gray-400">{{ ticket.cliente_nombre }}</p>
        <p class="text-[11px] text-gray-500 mt-0.5">{{ ticket.producto_nombre }}</p>
        <p v-if="ticket.fecha_tope" class="text-[11px] mt-0.5" :class="esVencido(ticket) ? 'text-red-600 font-medium' : 'text-gray-400'">
          Tope: {{ formatearFecha(ticket.fecha_tope) }}
        </p>
        <select
          :value="ticket.estado"
          class="mt-2 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-ring"
          @change="$emit('cambiar-estado', ticket.id, ($event.target as HTMLSelectElement).value as EstadoTicketPostVenta)"
        >
          <option v-for="c in columnas" :key="c.estado" :value="c.estado">Mover a: {{ c.titulo }}</option>
        </select>
      </div>
      <p v-if="!grupos[tabActiva]?.length" class="text-sm text-gray-400 text-center py-6">
        Sin elementos en este estado.
      </p>
    </div>

    <div class="hidden lg:grid lg:grid-cols-7 gap-3 overflow-x-auto">
      <div
        v-for="col in columnas"
        :key="col.estado"
        class="min-w-[190px] rounded-lg p-3"
        :class="colorTicketPostVenta(col.estado).clases.split(' ')[0]"
      >
        <h3
          class="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center justify-between"
          :class="colorTicketPostVenta(col.estado).clases.split(' ')[1]"
        >
          {{ col.titulo }}
          <span class="opacity-60">{{ grupos[col.estado]?.length ?? 0 }}</span>
        </h3>

        <draggable
          v-model="grupos[col.estado]"
          group="tickets-post-venta"
          item-key="id"
          class="space-y-2 min-h-[80px]"
          @change="(evt) => onDragChange(evt, col.estado)"
        >
          <template #item="{ element: ticket }">
            <div class="border border-gray-100 rounded-xl p-3 bg-white shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
              <div class="flex items-start justify-between gap-2 mb-2">
                <NuxtLink :to="`/post-venta/${ticket.id}`" class="font-medium text-sm text-gray-800 hover:underline">
                  {{ ticket.n_guia }}
                </NuxtLink>
                <span v-if="esVencido(ticket)" class="text-xs text-red-600 font-medium">vencido</span>
              </div>
              <p class="text-xs text-gray-400">{{ ticket.cliente_nombre }}</p>
              <p class="text-[11px] text-gray-500 mt-0.5">{{ ticket.producto_nombre }}</p>
              <p v-if="ticket.fecha_tope" class="text-[11px] mt-0.5" :class="esVencido(ticket) ? 'text-red-600 font-medium' : 'text-gray-400'">
                Tope: {{ formatearFecha(ticket.fecha_tope) }}
              </p>
            </div>
          </template>
        </draggable>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Build de verificación**

```bash
rm -rf .nuxt .output && npm run build 2>&1 | tail -20
```

Expected: `✨ Build complete!`.

- [ ] **Step 4: Commit**

```bash
git add app/components/post-venta/TicketBoard.vue
git commit -m "feat: TicketBoard post-venta responsive (tabs + lista mobile, grid en lg+)"
```

---

### Task 4: Verificación manual end-to-end (la hace el usuario)

**Files:** ninguno.

- [ ] **Step 1: Levantar dev server**

```bash
rm -rf .nuxt && npm run dev
```

- [ ] **Step 2: Seguir los 6 pasos de "Testing (manual)" de la spec**

Ver `docs/superpowers/specs/2026-07-16-responsive-kanban-design.md`,
sección "Testing (manual, sin suite automatizada)", en `/leads`,
`/tickets` y `/post-venta`.

- [ ] **Step 3: Confirmar con el usuario antes de cerrar la task**

No marcar como completada hasta recibir confirmación explícita.
