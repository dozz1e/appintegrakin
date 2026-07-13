# Filtro por Vendedor en Clientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un filtro por vendedor asignado (`owner_id`) a la vista de clientes, combinado con el buscador de texto ya existente.

**Architecture:** Filtrado 100% client-side sobre los clientes ya cargados por RLS — mismo patrón que el buscador de texto ya existente en `ClienteSplitView.vue` y que los filtros de categoría/estado ya implementados en productos. La página (`clientes/index.vue`) pasa a cargar también la lista de usuarios (reutilizando `useUsuarios().fetchUsuarios()`, sin cambios a ese composable) y se la entrega como prop nueva al componente de vista.

**Tech Stack:** Nuxt 4 / Vue 3, TypeScript, Tailwind. Sin framework de tests instalado — verificación vía `npm run build` (type-check) y testing manual en navegador.

## Global Constraints

- Único filtro nuevo: vendedor asignado (`owner_id`). No se agregan otros filtros en este plan.
- Filtrado 100% client-side — no se toca `useClientes.ts`, `useUsuarios.ts` ni RLS.
- El filtro de vendedor se combina con la búsqueda de texto existente en AND (ambos a la vez), nunca reemplaza el buscador.
- Debe incluir una opción "Sin asignar" para clientes con `owner_id` nulo, además de "Todos" y un ítem por cada usuario.
- Usar `node`/`npm` del sistema (no `bun`) para cualquier comando.
- Spec completo en `docs/superpowers/specs/2026-07-12-clientes-filtro-vendedor-design.md`.

---

### Task 1: Filtro de vendedor en `ClienteSplitView.vue` + carga de usuarios en `clientes/index.vue`

**Files:**
- Modify: `app/pages/clientes/index.vue`
- Modify: `app/components/clientes/ClienteSplitView.vue`

**Interfaces:**
- Consumes: `useUsuarios()` → `fetchUsuarios(): Promise<Usuario[]>` (ya existe, `app/composables/useUsuarios.ts`, sin cambios — mismo uso que `admin/auditoria/index.vue`); `Usuario` type (ya existe, mismo archivo).
- Produces: nueva prop `usuarios: Usuario[]` en `ClienteSplitView`, consumida solo dentro de ese componente. Último task del plan — nada más depende de esto.

- [ ] **Step 1: Agregar la carga de usuarios en `clientes/index.vue`**

En `app/pages/clientes/index.vue`, reemplazar:

```ts
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
```

por:

```ts
<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'
import type { Usuario } from '~/composables/useUsuarios'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'clientes', actions: ['view', 'view_all'] },
})

const { fetchClientes, importClientes, deleteCliente } = useClientes()
const { fetchUsuarios } = useUsuarios()
const { can } = usePermissions()
const { parsearCSV, descargarCSV } = useCsv()
const { success, error } = useToast()

const clientes = ref<Cliente[]>([])
const usuarios = ref<Usuario[]>([])
const cargando = ref(true)
const importando = ref(false)
const inputArchivo = ref<HTMLInputElement | null>(null)
const clienteAEliminar = ref<Cliente | null>(null)
const eliminando = ref(false)

onMounted(async () => {
  clientes.value = await fetchClientes()
  usuarios.value = await fetchUsuarios()
  cargando.value = false
})
```

Nota: el resto del archivo (`onExportar`, `onArchivoSeleccionado`, `onConfirmarEliminar`, y todo el `<template>`) no cambia, **excepto** la línea que invoca `ClientesClienteSplitView` dentro del template, que pasa a llevar la nueva prop. Buscar:

```html
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <ClientesClienteSplitView v-else :clientes="clientes" @eliminar="clienteAEliminar = $event" />
```

y reemplazar por:

```html
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <ClientesClienteSplitView v-else :clientes="clientes" :usuarios="usuarios" @eliminar="clienteAEliminar = $event" />
```

- [ ] **Step 2: Agregar la prop, el estado y el filtro en `ClienteSplitView.vue`**

En `app/components/clientes/ClienteSplitView.vue`, reemplazar el bloque `<script setup>` completo:

```ts
<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'
import type { Ticket } from '~/composables/useTickets'

const props = defineProps<{ clientes: Cliente[] }>()
const emit = defineEmits<{ eliminar: [cliente: Cliente] }>()

const { fetchTicketsPorCliente } = useTickets()
const { can } = usePermissions()

const busqueda = ref('')
const seleccionadoId = ref<string | null>(null)
const ticketsSeleccionado = ref<Ticket[]>([])
const tabActiva = ref<'info' | 'tickets'>('info')

const puedeVerTickets = computed(() => can('tickets', 'view') || can('tickets', 'view_all'))

const clientesFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return props.clientes
  return props.clientes.filter(
    (c) => c.razon_social.toLowerCase().includes(q) || (c.nombre_contacto ?? '').toLowerCase().includes(q)
  )
})
```

por:

```ts
<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'
import type { Ticket } from '~/composables/useTickets'
import type { Usuario } from '~/composables/useUsuarios'

const props = defineProps<{ clientes: Cliente[]; usuarios: Usuario[] }>()
const emit = defineEmits<{ eliminar: [cliente: Cliente] }>()

const { fetchTicketsPorCliente } = useTickets()
const { can } = usePermissions()

const busqueda = ref('')
const filtroVendedor = ref('')
const seleccionadoId = ref<string | null>(null)
const ticketsSeleccionado = ref<Ticket[]>([])
const tabActiva = ref<'info' | 'tickets'>('info')

const puedeVerTickets = computed(() => can('tickets', 'view') || can('tickets', 'view_all'))

const clientesFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  return props.clientes.filter((c) => {
    if (q && !c.razon_social.toLowerCase().includes(q) && !(c.nombre_contacto ?? '').toLowerCase().includes(q)) return false
    if (filtroVendedor.value === 'sin_asignar' && c.owner_id !== null) return false
    if (filtroVendedor.value && filtroVendedor.value !== 'sin_asignar' && c.owner_id !== filtroVendedor.value) return false
    return true
  })
})
```

El resto del `<script setup>` (`seleccionado`, `totalTickets`, `ticketsAbiertos`, `ticketsResueltos`, el `watch`, `seleccionar`) no cambia.

- [ ] **Step 3: Agregar el `<select>` de vendedor en el template**

En el mismo archivo, dentro del `<template>`, buscar el bloque del buscador de texto:

```html
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar cliente..."
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
```

y reemplazar por (agrega el select debajo del input, ambos dentro del panel de 288px de ancho ya existente):

```html
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar cliente..."
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
      <select
        v-model="filtroVendedor"
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
      >
        <option value="">Todos los vendedores</option>
        <option value="sin_asignar">Sin asignar</option>
        <option v-for="u in usuarios" :key="u.id" :value="u.id">{{ u.full_name || u.email }}</option>
      </select>
```

El resto del template (la lista, el panel de detalle, tickets, tareas) no cambia.

- [ ] **Step 4: Verificar que el build pasa**

Run: `npm run build`
Expected: build termina sin errores de TypeScript/Vue.

- [ ] **Step 5: Testing manual en navegador**

Con `npm run dev` corriendo (verificar si ya hay uno con `ps aux | grep "npm run dev"` antes de levantar uno nuevo), abrir `/clientes` y verificar contra la spec (`docs/superpowers/specs/2026-07-12-clientes-filtro-vendedor-design.md`, sección "Testing"):

1. Sin filtro de vendedor ("Todos los vendedores"): se ven todos los clientes que ya se veían antes de este cambio.
2. Elegir un vendedor específico en el select: la lista de la izquierda solo muestra clientes con ese `owner_id`.
3. Elegir "Sin asignar": solo aparecen clientes con `owner_id` nulo.
4. Combinar texto en el buscador + un vendedor seleccionado: el resultado respeta ambos filtros a la vez (AND), no solo uno.
5. Volver a "Todos los vendedores" con el buscador vacío: la lista vuelve a mostrar todos los clientes.
6. Seleccionar un cliente de la lista filtrada y confirmar que el panel de detalle a la derecha sigue funcionando igual que antes (RUT, contacto, teléfono, email, dirección, tickets, tareas).

Si algún paso falla, corregir antes de continuar al commit.

- [ ] **Step 6: Commit**

```bash
git add app/pages/clientes/index.vue app/components/clientes/ClienteSplitView.vue
git commit -m "$(cat <<'EOF'
Agregar filtro por vendedor a la vista de clientes

Nuevo select "Vendedor" (Todos / Sin asignar / usuario) en el panel
izquierdo de ClienteSplitView, combinado en AND con el buscador de
texto ya existente. 100% client-side, reutiliza useUsuarios() sin
tocar useClientes.ts ni RLS.
EOF
)"
```
