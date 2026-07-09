# Eliminar clientes desde la UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar la opción de eliminar un cliente desde `/clientes` (listado) y `/clientes/[id]` (detalle), reutilizando el permiso `clientes.delete`, la política RLS `clientes_delete` y la función `deleteCliente()` que ya existen sin ninguna interfaz conectada.

**Architecture:** Un componente de modal reutilizable (`SharedConfirmDialog`, primero del proyecto) gatea la acción destructiva en ambas páginas. `ClienteTable` emite el evento de intención de borrar hacia su página padre (sigue el patrón existente de componente de presentación sin lógica de negocio). El error de foreign key (`error.code === '23503'`, cuando el cliente tiene leads/tickets asociados) se distingue de cualquier otro error para dar un mensaje específico.

**Tech Stack:** Nuxt 4 / Vue 3 / Supabase (Postgres + RLS). Sin librería de modales — CSS/Tailwind puro.

## Global Constraints

- Nunca usar `<component :is="stringName">` sin `componentMap` explícito — no aplica a este plan (no hay resolución dinámica de componentes), pero se documenta por si acaso.
- `useSupabaseUser()` devuelve el JWT decodificado: el id de usuario está en `.sub`, no en `.id` — no aplica directamente a este plan (no se toca auth), documentado por completitud.
- Componentes nuevos requieren `rm -rf .nuxt && npm run dev` para aparecer (el hot-reload no alcanza).
- Nada de tests automatizados en este repo todavía — la verificación de cada tarea es que el dev server levante sin errores + un checklist manual de navegador.
- Estilo de código existente: sin comentarios explicativos salvo que documenten un porqué no obvio. Colores arbitrarios de Tailwind (`bg-[#1075B5]`) para el color primario de marca, `rounded-2xl`/`border-gray-100`/`shadow-sm` para tarjetas y overlays, siguiendo `SharedCard`/`SharedPageHeader`.
- No se toca ninguna migración SQL ni política RLS en este plan — el backend ya existe completo (ver spec).

---

### Task 1: Componente `SharedConfirmDialog`

**Files:**
- Create: `app/components/shared/ConfirmDialog.vue`

**Interfaces:**
- Produces: componente `<SharedConfirmDialog>` (auto-import por convención de carpetas de Nuxt: `components/shared/ConfirmDialog.vue` → `SharedConfirmDialog`). Props: `open: boolean`, `titulo: string`, `mensaje: string`, `textoConfirmar?: string` (default `'Eliminar'`), `cargando?: boolean` (default `false`). Emits: `confirmar`, `cancelar`. Consumido por las Tasks 2 y 3.

- [ ] **Step 1: Crear el componente**

```vue
<!-- app/components/shared/ConfirmDialog.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean
    titulo: string
    mensaje: string
    textoConfirmar?: string
    cargando?: boolean
  }>(),
  { textoConfirmar: 'Eliminar', cargando: false }
)

defineEmits<{ confirmar: []; cancelar: [] }>()
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 w-full max-w-sm">
      <h2 class="text-sm font-semibold text-gray-800 mb-2">{{ titulo }}</h2>
      <p class="text-sm text-gray-500 mb-6">{{ mensaje }}</p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          :disabled="cargando"
          class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          @click="$emit('cancelar')"
        >
          Cancelar
        </button>
        <button
          type="button"
          :disabled="cargando"
          class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          @click="$emit('confirmar')"
        >
          {{ cargando ? 'Eliminando...' : textoConfirmar }}
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: `rm -rf .nuxt` y levantar el dev server**

```bash
rm -rf .nuxt
npm run dev
```

Esperar la línea `Local: http://localhost:3000/` sin errores de compilación (nada renderiza este componente todavía — este paso solo confirma que el archivo es sintácticamente válido y Nuxt lo registra).

- [ ] **Step 3: Detener el servidor y commitear**

```bash
git add app/components/shared/ConfirmDialog.vue
git commit -m "$(cat <<'EOF'
Agregar componente SharedConfirmDialog

Primer modal de confirmación del proyecto. Reutilizable para
cualquier acción destructiva (empezando por eliminar clientes).
EOF
)"
```

---

### Task 2: Eliminar cliente desde el listado (`/clientes`)

**Files:**
- Modify: `app/components/clientes/ClienteTable.vue`
- Modify: `app/pages/clientes/index.vue`

**Interfaces:**
- Consumes: `SharedConfirmDialog` (Task 1); `deleteCliente(id: string)` de `useClientes.ts` (ya existe, sin cambios de firma).
- Produces: evento `eliminar: [cliente: Cliente]` emitido por `ClienteTable` — mismo nombre y firma consumida por la Task 3 no aplica (Task 3 es una página distinta con su propio botón, no reutiliza este evento), pero establece el patrón de nombre que Task 3 replica.

- [ ] **Step 1: Agregar el botón "Eliminar" y el emit en `ClienteTable.vue`**

Reemplazar el contenido completo de `app/components/clientes/ClienteTable.vue`:

```vue
<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'

defineProps<{ clientes: Cliente[] }>()
defineEmits<{ eliminar: [cliente: Cliente] }>()
const { can } = usePermissions()
</script>

<template>
  <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <table class="w-full text-sm">
      <thead>
        <tr class="text-left border-b border-gray-100">
          <th class="py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Cliente</th>
          <th class="py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">RUT</th>
          <th class="py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Contacto</th>
          <th class="py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Teléfono</th>
          <th class="py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Email</th>
          <th class="py-3 px-4"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in clientes" :key="c.id" class="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
          <td class="py-3 px-4">
            <div class="flex items-center gap-3">
              <SharedAvatar :nombre="c.razon_social" size="sm" />
              <span class="font-medium text-gray-800">{{ c.razon_social }}</span>
            </div>
          </td>
          <td class="py-3 px-4 text-gray-500">{{ c.rut || '—' }}</td>
          <td class="py-3 px-4 text-gray-500">{{ c.nombre_contacto || '—' }}</td>
          <td class="py-3 px-4 text-gray-500">{{ c.telefono || '—' }}</td>
          <td class="py-3 px-4 text-gray-500">{{ c.email || '—' }}</td>
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end gap-3">
              <NuxtLink :to="`/clientes/${c.id}`" class="text-[#1075B5] hover:underline font-medium">
                {{ can('clientes', 'edit') ? 'Editar' : 'Ver' }}
              </NuxtLink>
              <button
                v-if="can('clientes', 'delete')"
                type="button"
                class="text-red-600 hover:underline font-medium"
                @click="$emit('eliminar', c)"
              >
                Eliminar
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="clientes.length === 0">
          <td colspan="6" class="py-10 text-center text-gray-400">Sin clientes todavía</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
```

- [ ] **Step 2: Agregar el estado y el handler de borrado en `clientes/index.vue`**

Reemplazar el contenido completo de `app/pages/clientes/index.vue`:

```vue
<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'clientes', actions: ['view', 'view_all'] },
})

const { fetchClientes, importClientes, deleteCliente } = useClientes()
const { can } = usePermissions()
const { parsearCSV, descargarCSV } = useCsv()
const { success, error } = useToast()

const clientes = ref<Cliente[]>([])
const cargando = ref(true)
const importando = ref(false)
const inputArchivo = ref<HTMLInputElement | null>(null)
const clienteAEliminar = ref<Cliente | null>(null)
const eliminando = ref(false)

onMounted(async () => {
  clientes.value = await fetchClientes()
  cargando.value = false
})

function onExportar() {
  const filas = clientes.value.map((c) => ({
    rut: c.rut ?? '',
    razon_social: c.razon_social,
    nombre_contacto: c.nombre_contacto ?? '',
    telefono: c.telefono ?? '',
    email: c.email ?? '',
  }))
  descargarCSV('clientes', filas)
}

async function onArchivoSeleccionado(e: Event) {
  const archivo = (e.target as HTMLInputElement).files?.[0]
  if (!archivo) return

  importando.value = true
  try {
    const filas = await parsearCSV(archivo)
    const { insertados, omitidos } = await importClientes(filas)
    success(`${insertados} clientes importados${omitidos ? `, ${omitidos} omitidos (duplicados o incompletos)` : ''}`)
    clientes.value = await fetchClientes()
  } catch (e) {
    error('No se pudo importar el archivo. Revisa el formato del CSV.')
  } finally {
    importando.value = false
    if (inputArchivo.value) inputArchivo.value.value = ''
  }
}

async function onConfirmarEliminar() {
  if (!clienteAEliminar.value) return
  eliminando.value = true
  try {
    await deleteCliente(clienteAEliminar.value.id)
    clientes.value = clientes.value.filter((c) => c.id !== clienteAEliminar.value!.id)
    success('Cliente eliminado')
  } catch (e: any) {
    if (e.code === '23503') {
      error('No se puede eliminar: el cliente tiene leads o tickets asociados. Resuélvelos primero.')
    } else {
      error('No se pudo eliminar el cliente. Intenta de nuevo.')
    }
  } finally {
    eliminando.value = false
    clienteAEliminar.value = null
  }
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Clientes">
      <template #accion>
        <div class="flex items-center gap-2">
          <button
            class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            @click="onExportar"
          >
            Exportar CSV
          </button>
          <button
            v-if="can('clientes', 'create')"
            :disabled="importando"
            class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            @click="inputArchivo?.click()"
          >
            {{ importando ? 'Importando...' : 'Importar CSV' }}
          </button>
          <input ref="inputArchivo" type="file" accept=".csv" class="hidden" @change="onArchivoSeleccionado" />
          <NuxtLink
            v-if="can('clientes', 'create')"
            to="/clientes/nuevo"
            class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Nuevo cliente
          </NuxtLink>
        </div>
      </template>
    </SharedPageHeader>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <ClientesClienteTable v-else :clientes="clientes" @eliminar="clienteAEliminar = $event" />

    <SharedConfirmDialog
      :open="!!clienteAEliminar"
      titulo="Eliminar cliente"
      :mensaje="`¿Eliminar a ${clienteAEliminar?.razon_social}? Esta acción no se puede deshacer.`"
      :cargando="eliminando"
      @confirmar="onConfirmarEliminar"
      @cancelar="clienteAEliminar = null"
    />
  </div>
</template>
```

- [ ] **Step 3: `rm -rf .nuxt` y levantar el dev server**

```bash
rm -rf .nuxt
npm run dev
```

- [ ] **Step 4: Checklist manual de navegador (para el usuario)**

1. Como usuario con `clientes.delete`: en `/clientes`, confirmar que aparece "Eliminar" en rojo junto a "Editar" en cada fila.
2. Click en "Eliminar" sobre un cliente **sin** leads/tickets asociados. Confirmar que aparece el modal con su nombre. Click en "Cancelar": el modal se cierra y el cliente sigue en la lista.
3. Repetir y esta vez confirmar. Verificar el toast "Cliente eliminado" y que la fila desaparece de la tabla sin recargar la página.
4. Click en "Eliminar" sobre un cliente que **sí** tiene tickets asociados (o creale uno de prueba primero). Confirmar. Verificar el toast de error específico ("tiene leads o tickets asociados") y que el cliente sigue en la lista.
5. Como usuario sin `clientes.delete`: confirmar que el botón "Eliminar" no aparece en ninguna fila.

- [ ] **Step 5: Detener el servidor y commitear**

```bash
git add app/components/clientes/ClienteTable.vue app/pages/clientes/index.vue
git commit -m "$(cat <<'EOF'
Agregar eliminar cliente desde el listado

ClienteTable emite la intención de borrar; la página controla el
modal de confirmación y distingue el rechazo por foreign key
(cliente con leads/tickets asociados) de cualquier otro error.
EOF
)"
```

---

### Task 3: Eliminar cliente desde el detalle (`/clientes/[id]`)

**Files:**
- Modify: `app/pages/clientes/[id].vue`

**Interfaces:**
- Consumes: `SharedConfirmDialog` (Task 1); `deleteCliente(id: string)` de `useClientes.ts`.

- [ ] **Step 1: Agregar el botón, el modal y el handler**

Reemplazar el contenido completo de `app/pages/clientes/[id].vue`:

```vue
<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'
import type { Ticket } from '~/composables/useTickets'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'clientes', actions: ['view', 'view_all'] },
})

const route = useRoute()
const { getCliente, updateCliente, deleteCliente } = useClientes()
const { fetchTicketsPorCliente } = useTickets()
const { can } = usePermissions()
const { success, error } = useToast()

const cliente = ref<Cliente | null>(null)
const tickets = ref<Ticket[]>([])
const cargando = ref(true)
const guardando = ref(false)
const confirmandoEliminar = ref(false)
const eliminando = ref(false)

onMounted(async () => {
  cliente.value = await getCliente(route.params.id as string)
  if (can('tickets', 'view') || can('tickets', 'view_all')) {
    tickets.value = await fetchTicketsPorCliente(cliente.value.id)
  }
  cargando.value = false
})

const onSubmit = async (payload: Record<string, unknown>) => {
  if (!cliente.value) return
  guardando.value = true
  try {
    cliente.value = await updateCliente(cliente.value.id, payload, cliente.value.version)
    success('Cliente actualizado')
  } catch (e: any) {
    if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este cliente mientras lo tenías abierto. Se recargaron los datos actuales, revisa e intenta de nuevo.')
      cliente.value = await getCliente(route.params.id as string)
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  } finally {
    guardando.value = false
  }
}

async function onConfirmarEliminar() {
  if (!cliente.value) return
  eliminando.value = true
  try {
    await deleteCliente(cliente.value.id)
    success('Cliente eliminado')
    await navigateTo('/clientes')
  } catch (e: any) {
    if (e.code === '23503') {
      error('No se puede eliminar: el cliente tiene leads o tickets asociados. Resuélvelos primero.')
    } else {
      error('No se pudo eliminar el cliente. Intenta de nuevo.')
    }
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-lg">
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <template v-else-if="cliente">
      <SharedPageHeader :titulo="cliente.razon_social" volver-a="/clientes" />

      <SharedCard>
        <ClientesClienteForm
          :model-value="cliente"
          :cargando="guardando"
          @submit="can('clientes', 'edit') ? onSubmit($event) : undefined"
        />
      </SharedCard>

      <div v-if="can('clientes', 'delete')" class="mt-6">
        <SharedCard>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold text-gray-700">Eliminar cliente</h2>
              <p class="text-xs text-gray-400 mt-1">Esta acción no se puede deshacer.</p>
            </div>
            <button
              type="button"
              class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              @click="confirmandoEliminar = true"
            >
              Eliminar cliente
            </button>
          </div>
        </SharedCard>
      </div>

      <div v-if="can('tickets', 'view') || can('tickets', 'view_all')" class="mt-6">
        <SharedCard>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-gray-700">Tickets de servicio técnico</h2>
            <NuxtLink
              v-if="can('tickets', 'create')"
              :to="`/tickets/nuevo?cliente_id=${cliente.id}`"
              class="text-xs text-[#1075B5] hover:underline font-medium"
            >
              + Nuevo ticket
            </NuxtLink>
          </div>
          <ul v-if="tickets.length" class="space-y-2">
            <li
              v-for="t in tickets"
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
        </SharedCard>
      </div>

      <SharedConfirmDialog
        :open="confirmandoEliminar"
        titulo="Eliminar cliente"
        :mensaje="`¿Eliminar a ${cliente.razon_social}? Esta acción no se puede deshacer.`"
        :cargando="eliminando"
        @confirmar="onConfirmarEliminar"
        @cancelar="confirmandoEliminar = false"
      />
    </template>
    <p v-else class="text-red-600">Cliente no encontrado</p>
  </div>
</template>
```

**Nota:** `colorTicket` ya se usa en el template original sin import visible en el `<script setup>` original (probablemente un composable/util auto-importado, ej. `useTickets` o un helper global) — este paso no lo toca, se preserva tal cual estaba.

- [ ] **Step 2: `rm -rf .nuxt` y levantar el dev server**

```bash
rm -rf .nuxt
npm run dev
```

- [ ] **Step 3: Checklist manual de navegador (para el usuario)**

1. Como usuario con `clientes.delete`: entrar al detalle de un cliente sin leads/tickets asociados. Confirmar que aparece la tarjeta "Eliminar cliente" con el botón rojo.
2. Click en "Eliminar cliente", confirmar que aparece el modal. Click en "Cancelar": el modal se cierra, seguís en la misma página, el cliente no se tocó.
3. Repetir y confirmar. Verificar que redirige a `/clientes` y aparece el toast "Cliente eliminado".
4. Entrar al detalle de un cliente **con** tickets asociados, click en "Eliminar cliente", confirmar. Verificar el toast de error específico y que la página se queda en el detalle (no redirige) con el cliente intacto.
5. Como usuario sin `clientes.delete`: confirmar que la tarjeta "Eliminar cliente" no aparece en el detalle.

- [ ] **Step 4: Detener el servidor y commitear**

```bash
git add app/pages/clientes/\[id\].vue
git commit -m "$(cat <<'EOF'
Agregar eliminar cliente desde el detalle

Mismo modal y mismo manejo de error por foreign key que en el
listado. Al eliminar con éxito redirige a /clientes.
EOF
)"
```

---

## Self-Review (completado durante la escritura del plan)

**Cobertura del spec:**
- `SharedConfirmDialog` (props, emits, estilo) → Task 1. ✓
- Botón en `ClienteTable` + estado/handler en `clientes/index.vue` → Task 2. ✓
- Botón + modal + handler + redirect en `clientes/[id].vue` → Task 3. ✓
- Manejo de error `23503` vs genérico, en ambas páginas → Task 2 Step 2 y Task 3 Step 1. ✓
- Los 5 puntos de testing manual del spec → checklists de Task 2 Step 4 y Task 3 Step 3. ✓
- "Fuera de alcance" del spec (borrado de leads/tickets, cascada/SET NULL, conteo previo, soft-delete) → ningún archivo de leads/tickets tocado, sin migraciones nuevas, sin conteo previo agregado. ✓

**Placeholders:** ninguno — cada archivo modificado se entrega completo.

**Consistencia de tipos:** `deleteCliente(id: string)` se usa igual en Task 2 y Task 3 (firma ya existente, sin cambios). `SharedConfirmDialog` recibe las mismas props (`open`, `titulo`, `mensaje`, `cargando`) y emite los mismos eventos (`confirmar`, `cancelar`) en ambos consumidores. El evento `eliminar: [cliente: Cliente]` de `ClienteTable` (Task 2) es interno a esa página, no lo consume Task 3.
