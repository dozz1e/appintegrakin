# Vista de detalle (split view) para Clientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una segunda vista a `/clientes` (layout de 3 columnas: lista + detalle editable con métricas de tickets + tareas), alternable con un ícono junto a la tabla actual, que se mantiene sin cambios.

**Architecture:** Un componente nuevo, `app/components/clientes/ClienteSplitView.vue`, autocontenido (recibe `clientes: Cliente[]` por prop, emite `actualizado` cuando se guarda una edición). `app/pages/clientes/index.vue` agrega un `ref<'lista'|'detalle'>` y un botón de toggle en el `SharedPageHeader`, y renderiza `ClientesClienteTable` o `ClientesClienteSplitView` según ese estado. Todo el resto del sistema (`useClientes`, `useTickets`, `useTareas`, `ClienteForm`, `ClienteTable`, `SharedAvatar`, `SharedTareaList`, `SharedBadge`) se reutiliza sin modificar.

**Tech Stack:** Nuxt 4 / Vue 3, Supabase. Sin dependencias nuevas (`@nuxt/icon` ya instalado, `<Icon name="mdi:...">` ya se usa en `LeadTimeline.vue:88`).

## Global Constraints

- La tabla actual (`ClientesClienteTable`) no cambia — la vista nueva es una alternativa, no un reemplazo.
- Un solo ícono de toggle (no dos botones separados), con `title` e ícono que cambian según la vista activa — mismo patrón que tenía el botón de tema oscuro ya removido de este proyecto.
- Métricas del panel central: Total tickets, Abiertos (`estado !== 'cerrado'`, misma convención que `KpiTicketsAbiertos.vue`), Resueltos (`estado === 'resuelto'`) — nada de "deals" ni propiedades.
- Panel derecho: `<SharedTareaList entidad-tipo="cliente" :entidad-id="..." />` — ya soporta `'cliente'` como `entidad_tipo`, no requiere cambios en `useTareas.ts`.
- El panel central es editable ahí mismo, reutilizando `ClientesClienteForm` con el mismo flujo de `updateCliente` + optimistic locking (`CONFLICTO_VERSION`) que ya usa `app/pages/clientes/[id].vue`.
- **`ClientesClienteForm` debe llevar `:key="seleccionado.id"`** — su `form` interno es un `reactive()` construido una sola vez a partir de `modelValue` en el `setup()` del componente, sin watcher; si no se fuerza un remount al cambiar de cliente seleccionado, el formulario seguiría mostrando los datos del cliente anterior.
- No persiste la preferencia de vista entre sesiones (arranca siempre en `'lista'`).
- No se toca `app/pages/clientes/[id].vue`, `useClientes.ts`, `useTareas.ts`, `useTickets.ts`, `ClienteForm.vue`, `ClienteTable.vue`, `Avatar.vue`, `TareaList.vue`.
- No se agrega eliminar cliente, chat, ni datos de "deals"/propiedades en la vista nueva.
- No se agrega paginación ni virtualización a la lista izquierda (mismo supuesto de volumen que `ClienteTable.vue` hoy).
- Nada de tests automatizados en este repo todavía — la verificación es build + checklist manual de navegador.
- Componentes nuevos requieren `rm -rf .nuxt && npm run dev` (o `npx nuxt build`) para que Nuxt los registre.
- Sin comentarios explicativos salvo que documenten un porqué no obvio.

---

### Task 1: `ClienteSplitView.vue` + toggle en `/clientes`

**Files:**
- Create: `app/components/clientes/ClienteSplitView.vue`
- Modify: `app/pages/clientes/index.vue`

**Interfaces:**
- Consumes: `useClientes().updateCliente(id, payload, expectedVersion): Promise<Cliente>` (lanza `Error('CONFLICTO_VERSION')` en conflicto), `useClientes().getCliente(id): Promise<Cliente>`, `useTickets().fetchTicketsPorCliente(clienteId): Promise<Ticket[]>`, `usePermissions().can(resource, action): boolean`, `useToast().success/error(msg)`, `colorTicket(estado): { label, clases }` (auto-importado desde `estadoColores.ts`) — todos ya existentes, sin cambios de firma.
- Produces: `ClienteSplitView` exporta `defineProps<{ clientes: Cliente[] }>()` y `defineEmits<{ actualizado: [cliente: Cliente] }>()` — `index.vue` (mismo task) es el único consumidor.

- [ ] **Step 1: Crear `app/components/clientes/ClienteSplitView.vue`**

```vue
<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'
import type { Ticket } from '~/composables/useTickets'

const props = defineProps<{ clientes: Cliente[] }>()
const emit = defineEmits<{ actualizado: [cliente: Cliente] }>()

const { updateCliente, getCliente } = useClientes()
const { fetchTicketsPorCliente } = useTickets()
const { can } = usePermissions()
const { success, error } = useToast()

const busqueda = ref('')
const seleccionadoId = ref<string | null>(null)
const ticketsSeleccionado = ref<Ticket[]>([])
const tabActiva = ref<'info' | 'tickets'>('info')
const guardando = ref(false)

const puedeVerTickets = computed(() => can('tickets', 'view') || can('tickets', 'view_all'))

const clientesFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return props.clientes
  return props.clientes.filter(
    (c) => c.razon_social.toLowerCase().includes(q) || (c.nombre_contacto ?? '').toLowerCase().includes(q)
  )
})

const seleccionado = computed(() => props.clientes.find((c) => c.id === seleccionadoId.value) ?? null)

const totalTickets = computed(() => ticketsSeleccionado.value.length)
const ticketsAbiertos = computed(() => ticketsSeleccionado.value.filter((t) => t.estado !== 'cerrado').length)
const ticketsResueltos = computed(() => ticketsSeleccionado.value.filter((t) => t.estado === 'resuelto').length)

watch(seleccionadoId, async (id) => {
  tabActiva.value = 'info'
  ticketsSeleccionado.value = []
  if (id && puedeVerTickets.value) {
    ticketsSeleccionado.value = await fetchTicketsPorCliente(id)
  }
})

function seleccionar(c: Cliente) {
  seleccionadoId.value = c.id
}

async function onSubmit(payload: Partial<Cliente>) {
  if (!seleccionado.value) return
  guardando.value = true
  try {
    const actualizado = await updateCliente(seleccionado.value.id, payload, seleccionado.value.version)
    emit('actualizado', actualizado)
    success('Cliente actualizado')
  } catch (e: any) {
    if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este cliente mientras lo tenías abierto. Se recargaron los datos actuales, revisa e intenta de nuevo.')
      emit('actualizado', await getCliente(seleccionado.value.id))
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="flex gap-4 items-start">
    <div class="w-72 shrink-0 bg-white border border-gray-100 rounded-2xl shadow-sm p-3 max-h-[70vh] overflow-y-auto">
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar cliente..."
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
      <ul class="space-y-1">
        <li
          v-for="c in clientesFiltrados"
          :key="c.id"
          class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors"
          :class="c.id === seleccionadoId ? 'bg-[#EAF4FA]' : 'hover:bg-gray-50'"
          @click="seleccionar(c)"
        >
          <SharedAvatar :nombre="c.razon_social" size="sm" />
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate">{{ c.razon_social }}</p>
            <p v-if="c.nombre_contacto" class="text-xs text-gray-400 truncate">{{ c.nombre_contacto }}</p>
          </div>
        </li>
      </ul>
      <p v-if="!clientesFiltrados.length" class="text-sm text-gray-400 text-center py-4">Sin resultados</p>
    </div>

    <div
      v-if="!seleccionado"
      class="flex-1 min-w-0 bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400"
    >
      Selecciona un cliente de la lista para ver su detalle.
    </div>

    <div v-else class="flex-1 min-w-0">
      <div class="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <div class="flex items-center gap-3 mb-4">
          <SharedAvatar :nombre="seleccionado.razon_social" size="md" />
          <div>
            <h2 class="text-lg font-semibold text-gray-800">{{ seleccionado.razon_social }}</h2>
            <p v-if="seleccionado.nombre_contacto" class="text-xs text-gray-400">{{ seleccionado.nombre_contacto }}</p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3 text-sm text-gray-600 mb-4">
          <p v-if="seleccionado.rut"><span class="text-gray-400">RUT:</span> {{ seleccionado.rut }}</p>
          <p v-if="seleccionado.telefono"><span class="text-gray-400">Teléfono:</span> {{ seleccionado.telefono }}</p>
          <p v-if="seleccionado.email"><span class="text-gray-400">Email:</span> {{ seleccionado.email }}</p>
        </div>

        <div v-if="puedeVerTickets" class="grid grid-cols-3 gap-3 mb-4">
          <div class="bg-gray-50 rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400">Total tickets</p>
            <p class="text-xl font-semibold text-gray-800">{{ totalTickets }}</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400">Abiertos</p>
            <p class="text-xl font-semibold text-gray-800">{{ ticketsAbiertos }}</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-3 text-center">
            <p class="text-xs text-gray-400">Resueltos</p>
            <p class="text-xl font-semibold text-gray-800">{{ ticketsResueltos }}</p>
          </div>
        </div>

        <div class="flex gap-4 border-b border-gray-100 mb-4">
          <button
            type="button"
            class="text-sm font-medium pb-2 border-b-2 transition-colors"
            :class="tabActiva === 'info' ? 'border-[#1075B5] text-[#1075B5]' : 'border-transparent text-gray-400 hover:text-gray-600'"
            @click="tabActiva = 'info'"
          >
            Información
          </button>
          <button
            v-if="puedeVerTickets"
            type="button"
            class="text-sm font-medium pb-2 border-b-2 transition-colors"
            :class="tabActiva === 'tickets' ? 'border-[#1075B5] text-[#1075B5]' : 'border-transparent text-gray-400 hover:text-gray-600'"
            @click="tabActiva = 'tickets'"
          >
            Tickets
          </button>
        </div>

        <ClientesClienteForm
          v-if="tabActiva === 'info'"
          :key="seleccionado.id"
          :model-value="seleccionado"
          :cargando="guardando"
          @submit="can('clientes', 'edit') ? onSubmit($event) : undefined"
        />

        <div v-else>
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-semibold text-gray-700">Tickets de servicio técnico</p>
            <NuxtLink
              v-if="can('tickets', 'create')"
              :to="`/tickets/nuevo?cliente_id=${seleccionado.id}`"
              class="text-xs text-[#1075B5] hover:underline font-medium"
            >
              + Nuevo ticket
            </NuxtLink>
          </div>
          <ul v-if="ticketsSeleccionado.length" class="space-y-2">
            <li
              v-for="t in ticketsSeleccionado"
              :key="t.id"
              class="text-sm border border-gray-100 rounded-xl p-3 flex items-center justify-between"
            >
              <NuxtLink :to="`/tickets/${t.id}`" class="hover:underline text-gray-700 font-medium">
                {{ t.titulo }}
              </NuxtLink>
              <SharedBadge :label="colorTicket(t.estado).label" :clases="colorTicket(t.estado).clases" />
            </li>
          </ul>
          <p v-else class="text-sm text-gray-400">Sin tickets todavía</p>
        </div>
      </div>
    </div>

    <div v-if="seleccionado" class="w-80 shrink-0">
      <SharedTareaList entidad-tipo="cliente" :entidad-id="seleccionado.id" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Agregar el toggle de vista en `app/pages/clientes/index.vue`**

Agregar el `ref` de vista y el handler de sincronización, junto a los demás `ref`/funciones ya existentes en el `<script setup>`:

```ts
const vista = ref<'lista' | 'detalle'>('lista')

function onActualizado(actualizado: Cliente) {
  const idx = clientes.value.findIndex((c) => c.id === actualizado.id)
  if (idx !== -1) clientes.value[idx] = actualizado
}
```

En el `#accion` del `SharedPageHeader`, agregar el botón de toggle como primer elemento del `<div class="flex items-center gap-2">` (antes de "Exportar CSV"):

```html
<button
  type="button"
  :title="vista === 'lista' ? 'Ver detalle' : 'Ver como lista'"
  class="border border-gray-200 text-gray-600 hover:bg-gray-50 w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
  @click="vista = vista === 'lista' ? 'detalle' : 'lista'"
>
  <Icon :name="vista === 'lista' ? 'mdi:card-account-details-outline' : 'mdi:view-list'" class="w-5 h-5" />
</button>
```

Reemplazar el bloque que renderiza la tabla:

```html
<p v-if="cargando" class="text-gray-400">Cargando...</p>
<ClientesClienteTable v-else-if="vista === 'lista'" :clientes="clientes" @eliminar="clienteAEliminar = $event" />
<ClientesClienteSplitView v-else :clientes="clientes" @actualizado="onActualizado" />
```

(el resto del archivo — `SharedConfirmDialog`, importar/exportar CSV, etc. — no cambia).

- [ ] **Step 3: `rm -rf .nuxt` y build de verificación**

```bash
rm -rf .nuxt .output
npx nuxt build
```

Expected: build completo sin errores de TypeScript/Vue. Luego `rm -rf .output` para no commitear la salida del build.

- [ ] **Step 4: Checklist manual de navegador**

En `/clientes`, con un usuario que tenga permiso `clientes.view`/`view_all`:

1. Confirmar que el ícono de toggle cambia entre la tabla actual (sin cambios) y la vista nueva de 3 columnas.
2. En la vista nueva, sin seleccionar nada: confirmar el mensaje de placeholder en el centro y que no aparece el panel de tareas a la derecha.
3. Buscar un cliente por nombre en el buscador izquierdo y confirmar que filtra por razón social y por nombre de contacto.
4. Seleccionar un cliente: confirmar que el header del panel central muestra sus datos, que las 3 tarjetas de tickets muestran números coherentes con `/clientes/[id]` del mismo cliente, y que el tab "Información" arranca con sus datos actuales en el formulario.
5. Cambiar de cliente seleccionado sin recargar la página y confirmar que el formulario del tab "Información" se actualiza con los datos del NUEVO cliente (no se queda pegado en los del anterior) — este es el caso que cubre el `:key="seleccionado.id"`.
6. Editar un campo en "Información" y guardar. Confirmar que se guarda (mismo comportamiento que `/clientes/[id]`), y que al volver a la vista de tabla el dato editado aparece actualizado sin recargar la página completa.
7. Cambiar al tab "Tickets" y confirmar que lista los tickets del cliente seleccionado, con "+ Nuevo ticket" si corresponde por permiso.
8. Crear una tarea en el panel derecho para el cliente seleccionado; cambiar de cliente y confirmar que el panel de tareas muestra las tareas del nuevo cliente, no las del anterior.
9. Repetir con un usuario SIN permiso `tickets.view`/`view_all`: confirmar que no aparecen ni la fila de tarjetas ni el tab "Tickets", sin errores en consola.

- [ ] **Step 5: Commit**

```bash
git add app/components/clientes/ClienteSplitView.vue app/pages/clientes/index.vue
git commit -m "$(cat <<'EOF'
Agregar vista de detalle (split view) para Clientes

Nueva vista alternable con un ícono en /clientes: lista + panel de
detalle editable (ClienteForm reutilizado) con métricas de tickets
(Total/Abiertos/Resueltos) y tareas y recordatorios del cliente
seleccionado (SharedTareaList, entidad_tipo='cliente'). La tabla
actual no cambia. ClienteForm se remonta por :key al cambiar de
cliente seleccionado, porque su form interno no reacciona a cambios
de modelValue.
EOF
)"
```

---

## Self-Review (completado durante la escritura del plan)

**Cobertura del spec:**
- Tabla actual sin cambios → Step 2 solo agrega, no modifica el uso existente de `ClientesClienteTable`. ✓
- Un solo ícono de toggle con título/ícono dependientes del estado → Step 2. ✓
- Métricas basadas en tickets (Total/Abiertos/Resueltos, misma convención que `KpiTicketsAbiertos.vue`) → Step 1, `totalTickets`/`ticketsAbiertos`/`ticketsResueltos`. ✓
- Panel derecho = `SharedTareaList` con `entidad-tipo="cliente"`, sin chat → Step 1, template. ✓
- Panel central editable con `ClienteForm` + optimistic locking + `CONFLICTO_VERSION` → Step 1, `onSubmit`. ✓
- Bug potencial del `form` no reactivo de `ClienteForm` → cubierto explícitamente con `:key="seleccionado.id"` (Global Constraints + Step 1 + checklist item 5). ✓
- Fuera de alcance del spec (eliminar cliente, chat, deals/propiedades, cambios a `/clientes/[id]`, `useClientes.ts`, `useTareas.ts`, `useTickets.ts`, `ClienteForm.vue`, `ClienteTable.vue`, paginación) → ningún step los toca. ✓
- Los 9 casos de testing del spec → Step 4. ✓

**Placeholders:** ninguno — los dos archivos se entregan con contenido completo (el nuevo componente entero, y los fragmentos exactos a agregar en `index.vue`).

**Consistencia de tipos:** `ClienteSplitView` usa `defineProps<{ clientes: Cliente[] }>()` / `defineEmits<{ actualizado: [cliente: Cliente] }>()`; `index.vue` lo invoca como `<ClientesClienteSplitView :clientes="clientes" @actualizado="onActualizado" />` con `onActualizado(actualizado: Cliente)` — firmas coinciden. `updateCliente(id, payload, expectedVersion)` y `getCliente(id)` se usan con la misma firma que ya tiene `useClientes.ts` (no se modifica ese archivo). `fetchTicketsPorCliente(clienteId): Promise<Ticket[]>` idem. `ClientesClienteForm`'s `@submit` payload (`Partial<Cliente>`) coincide con la firma de `onSubmit` en `ClienteSplitView`.
