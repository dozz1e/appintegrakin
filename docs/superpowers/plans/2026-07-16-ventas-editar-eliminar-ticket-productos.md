# Editar/eliminar ventas + productos comprados en tickets — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar/eliminar ventas (con campo `valor` funcional) y permitir asociar varios productos comprados a un ticket de servicio técnico.

**Architecture:** Parte A extiende `useVentas.ts` y reescribe `VentaList.vue` para agregar edición/borrado inline (mismo patrón ya usado en `TareaList.vue`). Parte B agrega una tabla de relación `ticket_productos` (muchos a muchos) con RLS en cascada sobre `tickets`, un composable nuevo `useTicketProductos.ts`, y wiring en `TicketForm.vue`/`tickets/nuevo.vue`/`tickets/[id].vue` de servicio técnico.

**Tech Stack:** Nuxt 4 + Vue 3 + Supabase (Postgres/RLS) + Tailwind. Sin librería de testing en el proyecto.

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-07-16-ventas-editar-eliminar-ticket-productos-design.md` — cualquier duda de alcance se resuelve ahí, no inventar nada nuevo.
- Usar siempre `npm`/`node` del sistema, nunca `bun`.
- Este proyecto **no tiene suite de tests automatizada** (sin `test` script en `package.json`, sin `*.test.ts`/`*.spec.ts`). La verificación de cada tarea es `npm run build` (debe terminar en "Build complete!" sin errores de tipos/compilación) — es el mismo patrón usado en todo el historial de commits de este repo. No agregar un framework de testing nuevo.
- Componentes/composables nuevos requieren `rm -rf .nuxt` antes de `npm run dev` si se prueba en modo desarrollo (hot-reload no alcanza) — no aplica a `npm run build`, que siempre parte limpio.
- Migraciones SQL: crear el archivo en `supabase/migrations/` **y** aplicarlo al proyecto Supabase real con la tool `mcp__supabase__apply_migration` (mismo criterio que las migraciones previas del roadmap) — el archivo en git por sí solo no alcanza.
- Después de cada task: `git add` de los archivos tocados + commit. No hacer `git push` (requiere autenticación interactiva que este entorno no resuelve — lo corre el usuario).
- Testing manual real (browser) lo hace el usuario, no el agente — al final del plan hay un checklist para él, no para ejecutar acá.

---

### Task 1: `useVentas.ts` — agregar `actualizarVenta` y `eliminarVenta`

**Files:**
- Modify: `app/composables/useVentas.ts`

**Interfaces:**
- Produces: `actualizarVenta(id: string, payload: Partial<Pick<Venta,'producto_id'|'valor'|'fecha'>>, expectedVersion?: number): Promise<Venta>`, `eliminarVenta(id: string): Promise<void>` — consumidos por Task 2.

- [ ] **Step 1: Agregar las dos funciones nuevas**

En `app/composables/useVentas.ts`, agregar después de `crearVenta` (antes del `return`):

```ts
  async function actualizarVenta(
    id: string,
    payload: Partial<Pick<Venta, 'producto_id' | 'valor' | 'fecha'>>,
    expectedVersion?: number
  ): Promise<Venta> {
    let query = supabase
      .from('ventas')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (expectedVersion !== undefined) query = query.eq('version', expectedVersion)

    const { data, error } = await query.select().maybeSingle()
    if (error) throw error

    if (expectedVersion !== undefined && !data) {
      throw new Error('CONFLICTO_VERSION')
    }
    return data
  }

  async function eliminarVenta(id: string): Promise<void> {
    const { data, error } = await supabase.from('ventas').delete().eq('id', id).select()
    if (error) throw error
    if (!data?.length) throw new Error('No se pudo eliminar la venta')
  }
```

- [ ] **Step 2: Actualizar el `return` del composable**

Cambiar:
```ts
  return { fetchVentasPorCliente, crearVenta }
```
por:
```ts
  return { fetchVentasPorCliente, crearVenta, actualizarVenta, eliminarVenta }
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: termina con "✨ Build complete!" sin errores de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add app/composables/useVentas.ts
git commit -m "feat: agregar actualizarVenta y eliminarVenta a useVentas"
```

---

### Task 2: `VentaList.vue` — campo valor, editar, eliminar

**Files:**
- Modify: `app/components/clientes/VentaList.vue`

**Interfaces:**
- Consumes: `actualizarVenta`/`eliminarVenta` de Task 1; `ProductosProductoBuscador` (componente ya existente, prop `modelValue: string`, emit `update:modelValue`); `usePermissions().can(resource, action): boolean`; `SharedConfirmDialog` (props `open`, `titulo`, `mensaje`, `cargando`, emits `confirmar`/`cancelar`).

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

Reemplazar **todo** `app/components/clientes/VentaList.vue` por:

```vue
<script setup lang="ts">
import type { Venta } from '~/composables/useVentas'
import type { Producto } from '~/composables/useProductos'

const props = defineProps<{ clienteId: string }>()

const { fetchVentasPorCliente, crearVenta, actualizarVenta, eliminarVenta } = useVentas()
const { fetchProductos } = useProductos()
const { success, error } = useToast()
const { can } = usePermissions()

const ventas = ref<Venta[]>([])
const productos = ref<Producto[]>([])
const cargando = ref(true)
const guardando = ref(false)

const productoId = ref('')
const fecha = ref('')
const hora = ref('')
const valor = ref<number | null>(null)

const idEditando = ref<string | null>(null)
const productoIdEditado = ref('')
const fechaEditada = ref('')
const horaEditada = ref('')
const valorEditado = ref<number | null>(null)
const guardandoEdicion = ref(false)

const aEliminar = ref<Venta | null>(null)
const eliminando = ref(false)

const errores = reactive<Record<string, string>>({})

async function cargar() {
  cargando.value = true
  const [v, p] = await Promise.all([fetchVentasPorCliente(props.clienteId), fetchProductos()])
  ventas.value = v
  productos.value = p
  cargando.value = false
}

onMounted(cargar)

function nombreProducto(productoId: string) {
  return productos.value.find((p) => p.id === productoId)?.nombre ?? '—'
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatearValor(valor: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor)
}

function construirFecha(fecha: string, hora: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const [horas, minutos] = hora.split(':').map(Number)
  return new Date(anio, mes - 1, dia, horas, minutos, 0).toISOString()
}

function aFechaInput(fechaIso: string): string {
  const d = new Date(fechaIso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function aHoraInput(fechaIso: string): string {
  const d = new Date(fechaIso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function validar(): boolean {
  errores.productoId = productoId.value ? '' : 'Selecciona un producto'
  errores.fecha = fecha.value ? '' : 'Ingresa la fecha'
  errores.hora = hora.value ? '' : 'Ingresa la hora'
  errores.valor = valor.value && valor.value > 0 ? '' : 'Ingresa el valor'
  return !Object.values(errores).some(Boolean)
}

async function onSubmit() {
  if (!validar()) return
  guardando.value = true
  try {
    await crearVenta(props.clienteId, productoId.value, valor.value ?? 0, construirFecha(fecha.value, hora.value))
    productoId.value = ''
    fecha.value = ''
    hora.value = ''
    valor.value = null
    await cargar()
    success('Venta registrada')
  } catch (e) {
    error('No se pudo registrar la venta')
  } finally {
    guardando.value = false
  }
}

function onEditar(venta: Venta) {
  idEditando.value = venta.id
  productoIdEditado.value = venta.producto_id
  fechaEditada.value = aFechaInput(venta.fecha)
  horaEditada.value = aHoraInput(venta.fecha)
  valorEditado.value = venta.valor
}

function onCancelarEdicion() {
  idEditando.value = null
}

async function onGuardarEdicion(venta: Venta) {
  if (!productoIdEditado.value || !fechaEditada.value || !horaEditada.value || !valorEditado.value || valorEditado.value <= 0) return
  guardandoEdicion.value = true
  try {
    const actualizada = await actualizarVenta(
      venta.id,
      {
        producto_id: productoIdEditado.value,
        fecha: construirFecha(fechaEditada.value, horaEditada.value),
        valor: valorEditado.value,
      },
      venta.version
    )
    const idx = ventas.value.findIndex((v) => v.id === venta.id)
    if (idx !== -1) ventas.value[idx] = actualizada
    idEditando.value = null
    success('Venta actualizada')
  } catch (e: any) {
    if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó esta venta. Se recargó la lista, revisa e intenta de nuevo.')
      await cargar()
      idEditando.value = null
    } else {
      error('No se pudo actualizar la venta')
    }
  } finally {
    guardandoEdicion.value = false
  }
}

async function onConfirmarEliminar() {
  if (!aEliminar.value) return
  eliminando.value = true
  try {
    await eliminarVenta(aEliminar.value.id)
    ventas.value = ventas.value.filter((v) => v.id !== aEliminar.value?.id)
    aEliminar.value = null
    success('Venta eliminada')
  } catch (e) {
    error('No se pudo eliminar la venta')
  } finally {
    eliminando.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-4 space-y-1">
      <ProductosProductoBuscador v-model="productoId" />
      <p v-if="errores.productoId" class="text-xs text-red-600">{{ errores.productoId }}</p>

      <div class="flex flex-wrap gap-2 pt-1">
        <input
          v-model="fecha"
          type="date"
          class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        />
        <input
          v-model="hora"
          type="time"
          class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        />
        <input
          v-model.number="valor"
          type="number"
          min="0"
          step="1"
          placeholder="Valor"
          class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        />
        <button
          :disabled="guardando"
          class="w-full sm:w-auto bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          @click="onSubmit"
        >
          Registrar venta
        </button>
      </div>
      <p v-if="errores.fecha" class="text-xs text-red-600">{{ errores.fecha }}</p>
      <p v-if="errores.hora" class="text-xs text-red-600">{{ errores.hora }}</p>
      <p v-if="errores.valor" class="text-xs text-red-600">{{ errores.valor }}</p>
    </div>

    <p v-if="cargando" class="text-sm text-gray-400">Cargando ventas...</p>
    <p v-else-if="!ventas.length" class="text-sm text-gray-400">Sin ventas todavía.</p>

    <ul v-else class="space-y-2">
      <li v-for="v in ventas" :key="v.id" class="p-2 rounded-lg bg-gray-50 text-sm">
        <div v-if="idEditando === v.id" class="space-y-2">
          <ProductosProductoBuscador v-model="productoIdEditado" />
          <div class="flex flex-wrap gap-2">
            <input
              v-model="fechaEditada"
              type="date"
              class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
            />
            <input
              v-model="horaEditada"
              type="time"
              class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
            />
            <input
              v-model.number="valorEditado"
              type="number"
              min="0"
              step="1"
              class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
            />
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="guardandoEdicion"
              class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              @click="onGuardarEdicion(v)"
            >
              Guardar
            </button>
            <button
              type="button"
              class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              @click="onCancelarEdicion"
            >
              Cancelar
            </button>
          </div>
        </div>
        <div v-else class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium text-gray-700 truncate">{{ nombreProducto(v.producto_id) }}</p>
            <p class="text-xs text-gray-400">{{ formatearFecha(v.fecha) }} · {{ formatearValor(v.valor) }}</p>
          </div>
          <div class="flex gap-3 shrink-0">
            <button
              v-if="can('ventas', 'edit')"
              type="button"
              class="text-gray-300 hover:text-[#1075B5] transition-colors p-1"
              title="Editar"
              @click="onEditar(v)"
            >
              <Icon name="mdi:pencil-outline" class="w-5 h-5" />
            </button>
            <button
              v-if="can('ventas', 'delete')"
              type="button"
              class="text-gray-300 hover:text-red-600 transition-colors p-1"
              title="Eliminar"
              @click="aEliminar = v"
            >
              <Icon name="mdi:trash-can-outline" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </li>
    </ul>

    <SharedConfirmDialog
      :open="!!aEliminar"
      titulo="Eliminar venta"
      mensaje="¿Eliminar esta venta? Esta acción no se puede deshacer."
      :cargando="eliminando"
      @confirmar="onConfirmarEliminar"
      @cancelar="aEliminar = null"
    />
  </div>
</template>
```

Nota: este reemplazo también saca dos `@click="abrirPicker"` que quedaban en los `<input type="date">` del archivo viejo — llamaban a una función que nunca estuvo definida/importada en el componente (bug preexistente, no relacionado a este pedido; los inputs de fecha nativos ya abren su selector solo con el click).

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: "✨ Build complete!" sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/components/clientes/VentaList.vue
git commit -m "feat: editar y eliminar ventas, agregar campo valor al formulario"
```

---

### Task 3: Migración `ticket_productos`

**Files:**
- Create: `supabase/migrations/20260716060000_ticket_productos.sql`

**Interfaces:**
- Produces: tabla `ticket_productos(id, ticket_id, producto_id, created_by, created_at)`, consumida por Task 4.

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- Relación muchos a muchos entre tickets de servicio técnico y los
-- productos que el cliente compró y que se vinculan al ticket (ver
-- docs/superpowers/specs/2026-07-16-ventas-editar-eliminar-ticket-productos-design.md).
-- Mismo patrón de RLS en cascada que entidad_imagenes
-- (20260716020000_entidad_imagenes.sql): la condición reusa las reglas
-- de tickets_select/tickets_update (20260702000300_rls_policies.sql)
-- contra la fila padre. Sin trigger de auditoría (no es una entidad de
-- negocio en sí misma, igual criterio que entidad_imagenes).

create table ticket_productos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  producto_id uuid not null references productos(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (ticket_id, producto_id)
);

create index idx_ticket_productos_ticket on ticket_productos(ticket_id);

alter table ticket_productos enable row level security;

create policy ticket_productos_select on ticket_productos for select using (
  exists (
    select 1 from tickets t where t.id = ticket_productos.ticket_id
    and (
      has_permission(auth.uid(), 'tickets', 'view_all')
      or (has_permission(auth.uid(), 'tickets', 'view') and t.owner_id = auth.uid())
    )
  )
);

create policy ticket_productos_insert on ticket_productos for insert with check (
  has_permission(auth.uid(), 'tickets', 'edit')
  and exists (
    select 1 from tickets t where t.id = ticket_productos.ticket_id
    and (has_permission(auth.uid(), 'tickets', 'view_all') or t.owner_id = auth.uid())
  )
);

create policy ticket_productos_delete on ticket_productos for delete using (
  has_permission(auth.uid(), 'tickets', 'edit')
  and exists (
    select 1 from tickets t where t.id = ticket_productos.ticket_id
    and (has_permission(auth.uid(), 'tickets', 'view_all') or t.owner_id = auth.uid())
  )
);
```

- [ ] **Step 2: Aplicar la migración al proyecto Supabase**

Usar la tool `mcp__supabase__apply_migration` con `name: "ticket_productos"` y el contenido SQL de arriba.

- [ ] **Step 3: Verificar que la tabla quedó creada**

Usar `mcp__supabase__list_tables` y confirmar que aparece `ticket_productos`, o correr con `mcp__supabase__execute_sql`:
```sql
select count(*) from ticket_productos;
```
Expected: `0` filas, sin error (confirma que la tabla y las policies existen).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260716060000_ticket_productos.sql
git commit -m "feat: tabla ticket_productos para asociar productos comprados a tickets"
```

---

### Task 4: `useTicketProductos.ts`

**Files:**
- Create: `app/composables/useTicketProductos.ts`

**Interfaces:**
- Consumes: tabla `ticket_productos` de Task 3.
- Produces: `useTicketProductos()` → `{ fetchProductosDeTicket(ticketId: string): Promise<Pick<Producto,'id'|'nombre'|'sku'>[]>, agregarProductoATicket(ticketId: string, productoId: string): Promise<void>, quitarProductoDeTicket(ticketId: string, productoId: string): Promise<void> }` — consumidos por Task 6.

- [ ] **Step 1: Crear el archivo**

```ts
// composables/useTicketProductos.ts

import type { Producto } from '~/composables/useProductos'

export function useTicketProductos() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  async function fetchProductosDeTicket(
    ticketId: string
  ): Promise<Pick<Producto, 'id' | 'nombre' | 'sku'>[]> {
    const { data, error } = await supabase
      .from('ticket_productos')
      .select('productos(id, nombre, sku)')
      .eq('ticket_id', ticketId)
    if (error) throw error
    return (data ?? []).map((r: any) => r.productos).filter(Boolean)
  }

  async function agregarProductoATicket(ticketId: string, productoId: string): Promise<void> {
    const { error } = await supabase
      .from('ticket_productos')
      .insert({ ticket_id: ticketId, producto_id: productoId, created_by: user.value?.sub })
    if (error) throw error
  }

  async function quitarProductoDeTicket(ticketId: string, productoId: string): Promise<void> {
    const { data, error } = await supabase
      .from('ticket_productos')
      .delete()
      .eq('ticket_id', ticketId)
      .eq('producto_id', productoId)
      .select()
    if (error) throw error
    if (!data?.length) throw new Error('No se pudo quitar el producto')
  }

  return { fetchProductosDeTicket, agregarProductoATicket, quitarProductoDeTicket }
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: "✨ Build complete!" sin errores. (Composable sin UI que lo consuma todavía — el build solo valida que compile.)

- [ ] **Step 3: Commit**

```bash
git add app/composables/useTicketProductos.ts
git commit -m "feat: agregar composable useTicketProductos"
```

---

### Task 5: `TicketForm.vue` (tickets, servicio técnico) — chips de productos comprados

**Files:**
- Modify: `app/components/tickets/TicketForm.vue`

**Interfaces:**
- Consumes: `useVentas().fetchVentasPorCliente(clienteId): Promise<Venta[]>` (ya existente), `useProductos().fetchProductosPorIds(ids): Promise<Pick<Producto,'id'|'nombre'|'sku'>[]>` (ya existente).
- Produces: prop nuevo `productosAsociados?: string[]`; emit cambia a `submit: [payload: Partial<Ticket>, archivo: File | null, productosIds: string[]]` — consumido por Task 6.

- [ ] **Step 1: Agregar imports, prop y estado de productos comprados**

En `app/components/tickets/TicketForm.vue`, cambiar:
```ts
import type { Ticket } from '~/composables/useTickets'
import type { Tecnico } from '~/composables/useTecnicos'

const props = defineProps<{
  modelValue?: Partial<Ticket>
  clienteIdFijo?: string
  clienteNombreFijo?: string
  cargando?: boolean
}>()
const emit = defineEmits<{ submit: [payload: Partial<Ticket>, archivo: File | null] }>()

const { fetchTecnicos } = useTecnicos()
const { can } = usePermissions()
```
por:
```ts
import type { Ticket } from '~/composables/useTickets'
import type { Tecnico } from '~/composables/useTecnicos'
import type { Producto } from '~/composables/useProductos'

const props = defineProps<{
  modelValue?: Partial<Ticket>
  clienteIdFijo?: string
  clienteNombreFijo?: string
  cargando?: boolean
  productosAsociados?: string[]
}>()
const emit = defineEmits<{
  submit: [payload: Partial<Ticket>, archivo: File | null, productosIds: string[]]
}>()

const { fetchTecnicos } = useTecnicos()
const { can } = usePermissions()
const { fetchVentasPorCliente } = useVentas()
const { fetchProductosPorIds } = useProductos()
```

- [ ] **Step 2: Agregar estado de productos comprados y el watch del cliente**

Después de `const tecnicos = ref<Tecnico[]>([])`, agregar:
```ts
const comprados = ref<Pick<Producto, 'id' | 'nombre' | 'sku'>[]>([])
const productosSeleccionados = ref<string[]>([...(props.productosAsociados ?? [])])

// Al elegir/tener cliente, muestra sus productos comprados (tabla
// ventas) para unirlos al ticket - immediate porque el cliente puede
// venir prefijado (clienteIdFijo) y el watch normal no dispara con el
// valor inicial.
watch(
  () => form.cliente_id,
  async (clienteId) => {
    comprados.value = []
    if (!clienteId) return
    const ventas = await fetchVentasPorCliente(clienteId)
    const ids = [...new Set(ventas.map((v) => v.producto_id))]
    comprados.value = await fetchProductosPorIds(ids)
  },
  { immediate: true }
)

function toggleProducto(id: string) {
  const idx = productosSeleccionados.value.indexOf(id)
  if (idx === -1) productosSeleccionados.value.push(id)
  else productosSeleccionados.value.splice(idx, 1)
}
```

- [ ] **Step 3: Actualizar `onSubmit` para emitir el tercer parámetro**

Cambiar:
```ts
const onSubmit = () => {
  if (!validar()) return
  emit('submit', { ...form, tecnico_id: form.tecnico_id || null }, archivoAdjunto.value)
}
```
por:
```ts
const onSubmit = () => {
  if (!validar()) return
  emit('submit', { ...form, tecnico_id: form.tecnico_id || null }, archivoAdjunto.value, productosSeleccionados.value)
}
```

- [ ] **Step 4: Agregar los chips en el template**

En el `<template>`, insertar el siguiente bloque justo después del `<div>` del campo Cliente (después de su `</div>` de cierre, antes del `<div>` del campo Título):

```html
    <div v-if="comprados.length">
      <label class="block text-sm font-medium mb-1 text-gray-700">Productos comprados</label>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="p in comprados"
          :key="p.id"
          type="button"
          class="text-xs px-2.5 py-1 rounded-full border transition-colors"
          :class="productosSeleccionados.includes(p.id)
            ? 'bg-[#1075B5] text-white border-[#1075B5]'
            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'"
          @click="toggleProducto(p.id)"
        >
          {{ p.nombre }}
        </button>
      </div>
    </div>
```

- [ ] **Step 5: Verificar build**

Run: `npm run build`
Expected: "✨ Build complete!" — puede fallar si `tickets/nuevo.vue`/`tickets/[id].vue` todavía usan la firma vieja del emit; si el build tira error de tipos ahí, es esperado hasta completar Task 6, pero antes de continuar confirmar que el error señalado es exactamente por la firma de `submit` en esos dos archivos y no por otra cosa.

- [ ] **Step 6: Commit**

```bash
git add app/components/tickets/TicketForm.vue
git commit -m "feat: chips de productos comprados (multi-selección) en TicketForm de servicio técnico"
```

---

### Task 6: Wiring en `tickets/nuevo.vue` y `tickets/[id].vue`

**Files:**
- Modify: `app/pages/tickets/nuevo.vue`
- Modify: `app/pages/tickets/[id].vue`

**Interfaces:**
- Consumes: `useTicketProductos()` de Task 4; nueva firma de emit `submit` y prop `productosAsociados` de Task 5.

- [ ] **Step 1: `tickets/nuevo.vue` — agregar el composable y asociar productos tras crear**

Cambiar:
```ts
const { createTicket } = useTickets()
const { getCliente } = useClientes()
```
por:
```ts
const { createTicket } = useTickets()
const { getCliente } = useClientes()
const { agregarProductoATicket } = useTicketProductos()
```

Cambiar:
```ts
const onSubmit = async (payload: Record<string, unknown>, archivo: File | null) => {
  cargando.value = true
  try {
    const ticket = await createTicket(payload)
    if (archivo) {
      try {
        await subirImagen('ticket', ticket.id, archivo)
      } catch (e) {
        error('Ticket creado, pero no se pudo subir la imagen')
      }
    }
    success('Ticket creado correctamente')
    await router.push(`/tickets/${ticket.id}`)
  } catch (e) {
    error('No se pudo crear el ticket. Intenta de nuevo.')
  } finally {
    cargando.value = false
  }
}
```
por:
```ts
const onSubmit = async (payload: Record<string, unknown>, archivo: File | null, productosIds: string[]) => {
  cargando.value = true
  try {
    const ticket = await createTicket(payload)
    if (archivo) {
      try {
        await subirImagen('ticket', ticket.id, archivo)
      } catch (e) {
        error('Ticket creado, pero no se pudo subir la imagen')
      }
    }
    if (productosIds.length) {
      try {
        await Promise.all(productosIds.map((id) => agregarProductoATicket(ticket.id, id)))
      } catch (e) {
        error('Ticket creado, pero no se pudieron asociar los productos')
      }
    }
    success('Ticket creado correctamente')
    await router.push(`/tickets/${ticket.id}`)
  } catch (e) {
    error('No se pudo crear el ticket. Intenta de nuevo.')
  } finally {
    cargando.value = false
  }
}
```

- [ ] **Step 2: `tickets/[id].vue` — cargar productos asociados y hacer diff al guardar**

Cambiar:
```ts
const route = useRoute()
const { getTicket, updateTicket, deleteTicket, asignarTecnico } = useTickets()
const { fetchTecnicos } = useTecnicos()
const { can } = usePermissions()
const { success, error } = useToast()

const ticket = ref<Ticket | null>(null)
const tecnicos = ref<Tecnico[]>([])
const cargando = ref(true)
const guardando = ref(false)
const asignando = ref(false)
const confirmandoEliminar = ref(false)
const eliminando = ref(false)

onMounted(async () => {
  ticket.value = await getTicket(route.params.id as string)
  if (can('tickets', 'assign')) {
    tecnicos.value = await fetchTecnicos()
  }
  cargando.value = false
})

const onSubmit = async (payload: Record<string, unknown>) => {
  if (!ticket.value) return
  guardando.value = true
  try {
    ticket.value = await updateTicket(ticket.value.id, payload, ticket.value.version)
    success('Ticket actualizado')
  } catch (e: any) {
    if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este ticket mientras lo tenías abierto. Se recargaron los datos actuales, revisa e intenta de nuevo.')
      ticket.value = await getTicket(route.params.id as string)
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  } finally {
    guardando.value = false
  }
}
```
por:
```ts
const route = useRoute()
const { getTicket, updateTicket, deleteTicket, asignarTecnico } = useTickets()
const { fetchTecnicos } = useTecnicos()
const { fetchProductosDeTicket, agregarProductoATicket, quitarProductoDeTicket } = useTicketProductos()
const { can } = usePermissions()
const { success, error } = useToast()

const ticket = ref<Ticket | null>(null)
const tecnicos = ref<Tecnico[]>([])
const productosAsociadosIds = ref<string[]>([])
const cargando = ref(true)
const guardando = ref(false)
const asignando = ref(false)
const confirmandoEliminar = ref(false)
const eliminando = ref(false)

onMounted(async () => {
  ticket.value = await getTicket(route.params.id as string)
  if (can('tickets', 'assign')) {
    tecnicos.value = await fetchTecnicos()
  }
  const productos = await fetchProductosDeTicket(route.params.id as string)
  productosAsociadosIds.value = productos.map((p) => p.id)
  cargando.value = false
})

const onSubmit = async (payload: Record<string, unknown>, _archivo: File | null, productosIds: string[]) => {
  if (!ticket.value) return
  guardando.value = true
  try {
    ticket.value = await updateTicket(ticket.value.id, payload, ticket.value.version)

    const ticketId = ticket.value.id
    const agregados = productosIds.filter((id) => !productosAsociadosIds.value.includes(id))
    const quitados = productosAsociadosIds.value.filter((id) => !productosIds.includes(id))
    await Promise.all([
      ...agregados.map((id) => agregarProductoATicket(ticketId, id)),
      ...quitados.map((id) => quitarProductoDeTicket(ticketId, id)),
    ])
    productosAsociadosIds.value = productosIds

    success('Ticket actualizado')
  } catch (e: any) {
    if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este ticket mientras lo tenías abierto. Se recargaron los datos actuales, revisa e intenta de nuevo.')
      ticket.value = await getTicket(route.params.id as string)
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  } finally {
    guardando.value = false
  }
}
```

- [ ] **Step 3: Pasar `productosAsociados` al `TicketForm` en el template**

En `app/pages/tickets/[id].vue`, cambiar:
```html
          <TicketsTicketForm :model-value="ticket" :cargando="guardando" @submit="onSubmit" />
```
por:
```html
          <TicketsTicketForm
            :model-value="ticket"
            :productos-asociados="productosAsociadosIds"
            :cargando="guardando"
            @submit="onSubmit"
          />
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: "✨ Build complete!" sin errores de TypeScript ni de compilación Vue.

- [ ] **Step 5: Commit**

```bash
git add app/pages/tickets/nuevo.vue "app/pages/tickets/[id].vue"
git commit -m "feat: asociar/desasociar productos comprados al crear y editar tickets"
```

---

## Checklist de testing manual (lo corre el usuario en el navegador, no el agente)

**Ventas** (`/clientes/[id]`, tab Ventas):
1. Crear una venta con valor > 0 → aparece en el listado con el monto formateado en CLP.
2. Editar una venta (producto/fecha/hora/valor) con un usuario del rol `ventas` o `post_venta` → guarda bien, el botón "Eliminar" no aparece para ese usuario.
3. Eliminar una venta con la cuenta `dueña` → desaparece del listado.
4. Abrir la misma venta en dos pestañas, editar y guardar en una, luego intentar guardar en la otra → error de conflicto de versión y la lista se recarga sola.

**Tickets — productos** (`/tickets/nuevo`, `/tickets/[id]`):
1. Crear un ticket con un cliente que tiene ventas registradas → aparecen chips de productos comprados, elegir 2 → quedan asociados tras crear (verificar reabriendo el ticket).
2. Crear un ticket con un cliente sin ventas → no aparecen chips, el ticket se crea normal.
3. Abrir un ticket existente con productos asociados → los chips correspondientes aparecen ya seleccionados (azules) al cargar.
4. En edición: deseleccionar un producto y seleccionar otro nuevo, guardar → al recargar la página, el ticket refleja exactamente ese cambio (no quedan ambos, no queda ninguno).
5. Crear un ticket desde el botón "Nuevo ticket" de la ficha de un cliente (`clienteIdFijo`) → los chips de productos comprados igual aparecen sin tocar nada del campo cliente.
