# Nueva venta: múltiples equipos y cantidad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El modal "Registrar venta" permite cargar varios equipos (productos) con su cantidad en una sola venta, arrancando con una línea por defecto; la edición de una venta existente gana un input de cantidad.

**Architecture:** Migración agrega columna `cantidad` a `ventas`. El composable `useVentas.ts` reemplaza `crearVenta` (una fila) por `crearVentas` (batch insert de N filas en una sola sentencia SQL — atómico sin necesitar transacción explícita ni RPC). `VentaList.vue` pasa su estado de creación de un `productoId` suelto a un array de líneas `{ productoId, cantidad }` con botones agregar/quitar; el bloque de edición inline gana un input numérico de cantidad.

**Tech Stack:** Nuxt 3, Supabase (Postgres), TypeScript.

## Global Constraints

- Sin suite de tests automatizada en este proyecto — verificación es `npm run build` (compila sin error) + prueba manual en navegador (el usuario la hace él mismo, no el agente).
- Único punto de creación de ventas en todo el código es `VentaList.vue` (confirmado por grep de `crearVenta`/`useVentas()`) — no hay otro lugar que tocar.
- `crearVenta` (singular) queda sin uso tras Task 3 y se elimina del composable — no dejar código muerto.
- Spec completo: `docs/superpowers/specs/2026-07-19-venta-multiples-equipos-design.md`.

---

## Task 1: Migración — columna `cantidad` en `ventas`

**Files:**
- Create: `supabase/migrations/20260719060000_ventas_cantidad.sql`

**Interfaces:**
- Produces: columna `ventas.cantidad integer not null default 1` con `check (cantidad > 0)`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260719060000_ventas_cantidad.sql

alter table public.ventas
  add column cantidad integer not null default 1;

alter table public.ventas
  add constraint ventas_cantidad_check check (cantidad > 0);
```

- [ ] **Step 2: Aplicar la migración**

Usar `mcp__supabase__apply_migration` con `name: "ventas_cantidad"` y el mismo `query` del Step 1.

- [ ] **Step 3: Verificar columna y constraint**

```sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_name = 'ventas' and column_name = 'cantidad';

select conname from pg_constraint where conname = 'ventas_cantidad_check';
```

Expected: la columna existe (`integer`, default `1`, `not null`), y el constraint existe.

- [ ] **Step 4: Regenerar tipos TypeScript**

Usar `mcp__supabase__generate_typescript_types`, parsear el JSON de salida (campo `types`) y escribir el resultado completo en `app/types/database.types.ts` (mismo procedimiento ya usado en este proyecto: `node -e "..."` para extraer y sobreescribir el archivo).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260719060000_ventas_cantidad.sql app/types/database.types.ts
git commit -m "$(cat <<'EOF'
feat: add cantidad column to ventas

Lets a single venta row track how many units of a product it
represents, needed for the multi-equipo sale form (next commits).
Default 1 keeps existing rows and any insert that omits it behaving
exactly as before.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `useVentas.ts` — `cantidad` en `Venta` y `crearVentas` batch

**Files:**
- Modify: `app/composables/useVentas.ts`

**Interfaces:**
- Consumes: columna `ventas.cantidad` de Task 1.
- Produces: `Venta.cantidad: number`; `crearVentas(clienteId: string, lineas: { productoId: string; cantidad: number }[], fecha: string): Promise<Venta[]>`; `actualizarVenta` acepta `cantidad` en su `Partial`.

- [ ] **Step 1: Agregar `cantidad` a la interfaz `Venta`**

En `app/composables/useVentas.ts:1-12`, reemplazar:

```ts
export interface Venta {
  id: string
  cliente_id: string
  producto_id: string
  valor: number
  fecha: string
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
}
```

por:

```ts
export interface Venta {
  id: string
  cliente_id: string
  producto_id: string
  cantidad: number
  valor: number
  fecha: string
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
}
```

- [ ] **Step 2: Reemplazar `crearVenta` por `crearVentas` (batch)**

En `app/composables/useVentas.ts:29-50`, reemplazar:

```ts
  async function crearVenta(
    clienteId: string,
    productoId: string,
    valor: number,
    fecha: string
  ): Promise<Venta> {
    const { data, error } = await supabase
      .from('ventas')
      .insert({
        cliente_id: clienteId,
        producto_id: productoId,
        valor,
        fecha,
        owner_id: user.value?.sub,
        created_by: user.value?.sub,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
```

por:

```ts
  async function crearVentas(
    clienteId: string,
    lineas: { productoId: string; cantidad: number }[],
    fecha: string
  ): Promise<Venta[]> {
    const { data, error } = await supabase
      .from('ventas')
      .insert(
        lineas.map((l) => ({
          cliente_id: clienteId,
          producto_id: l.productoId,
          cantidad: l.cantidad,
          valor: 0,
          fecha,
          owner_id: user.value?.sub,
          created_by: user.value?.sub,
        }))
      )
      .select()

    if (error) throw error
    return data
  }
```

- [ ] **Step 3: Agregar `cantidad` al `Partial` editable de `actualizarVenta`**

En `app/composables/useVentas.ts` (declaración de `actualizarVenta`), reemplazar:

```ts
  async function actualizarVenta(
    id: string,
    payload: Partial<Pick<Venta, 'producto_id' | 'valor' | 'fecha'>>,
    expectedVersion?: number
  ): Promise<Venta> {
```

por:

```ts
  async function actualizarVenta(
    id: string,
    payload: Partial<Pick<Venta, 'producto_id' | 'valor' | 'fecha' | 'cantidad'>>,
    expectedVersion?: number
  ): Promise<Venta> {
```

- [ ] **Step 4: Actualizar el `return` del composable**

Reemplazar:

```ts
  return { fetchVentasPorCliente, crearVenta, actualizarVenta, eliminarVenta }
```

por:

```ts
  return { fetchVentasPorCliente, crearVentas, actualizarVenta, eliminarVenta }
```

- [ ] **Step 5: Build verification**

Run: `npm run build`
Expected: falla en este punto porque `VentaList.vue` todavía usa `crearVenta`/`productoId` — eso se corrige en Task 3. Confirmar que el único error de compilación mencione `VentaList.vue` (no otro archivo), como evidencia de que `crearVenta` no tenía más consumidores.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useVentas.ts
git commit -m "$(cat <<'EOF'
feat: replace crearVenta with batch crearVentas in useVentas

crearVenta only ever inserted one row for one product. crearVentas
takes an array of {productoId, cantidad} lines and inserts them as a
single multi-row INSERT - Postgres runs that as one statement (all
rows or none), so a multi-equipo sale can't end up half-saved without
needing an explicit transaction or a new RPC.

Venta.cantidad and actualizarVenta's editable Partial follow the new
column from the previous migration. VentaList.vue (only caller) is
updated in the next commit - this one intentionally leaves the build
red for that file in between.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `VentaList.vue` — modal de creación con líneas dinámicas

**Files:**
- Modify: `app/components/clientes/VentaList.vue`

**Interfaces:**
- Consumes: `crearVentas` de Task 2.
- Produces: estado `lineas: { productoId: string; cantidad: number }[]` con `agregarLinea()`/`quitarLinea(index: number)`.

- [ ] **Step 1: Reemplazar el estado de creación**

En `app/components/clientes/VentaList.vue:17-19`, reemplazar:

```ts
const productoId = ref('')
const fecha = ref('')
const hora = ref('')
```

por:

```ts
interface LineaVentaForm {
  productoId: string
  cantidad: number
}

const lineas = ref<LineaVentaForm[]>([{ productoId: '', cantidad: 1 }])
const erroresLineas = ref<string[]>([])
const fecha = ref('')
const hora = ref('')

function agregarLinea() {
  lineas.value.push({ productoId: '', cantidad: 1 })
}

function quitarLinea(index: number) {
  if (lineas.value.length <= 1) return
  lineas.value.splice(index, 1)
}
```

- [ ] **Step 2: Actualizar `validar()` para validar cada línea**

En `app/components/clientes/VentaList.vue:81-86`, reemplazar:

```ts
function validar(): boolean {
  errores.productoId = productoId.value ? '' : 'Selecciona un producto'
  errores.fecha = fecha.value ? '' : 'Ingresa la fecha'
  errores.hora = hora.value ? '' : 'Ingresa la hora'
  return !Object.values(errores).some(Boolean)
}
```

por:

```ts
function validar(): boolean {
  erroresLineas.value = lineas.value.map((l) => {
    if (!l.productoId) return 'Selecciona un producto'
    if (!l.cantidad || l.cantidad < 1) return 'Cantidad inválida'
    return ''
  })
  errores.fecha = fecha.value ? '' : 'Ingresa la fecha'
  errores.hora = hora.value ? '' : 'Ingresa la hora'
  return !erroresLineas.value.some(Boolean) && !errores.fecha && !errores.hora
}
```

- [ ] **Step 3: Actualizar `onSubmit()`**

En `app/components/clientes/VentaList.vue:88-104`, reemplazar:

```ts
async function onSubmit() {
  if (!validar()) return
  guardando.value = true
  try {
    await crearVenta(props.clienteId, productoId.value, 0, construirFecha(fecha.value, hora.value))
    productoId.value = ''
    fecha.value = ''
    hora.value = ''
    modalNuevaAbierta.value = false
    await cargar()
    success('Venta registrada')
  } catch (e) {
    error('No se pudo registrar la venta')
  } finally {
    guardando.value = false
  }
}
```

por:

```ts
async function onSubmit() {
  if (!validar()) return
  guardando.value = true
  try {
    await crearVentas(
      props.clienteId,
      lineas.value.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
      construirFecha(fecha.value, hora.value)
    )
    lineas.value = [{ productoId: '', cantidad: 1 }]
    erroresLineas.value = []
    fecha.value = ''
    hora.value = ''
    modalNuevaAbierta.value = false
    await cargar()
    success('Venta registrada')
  } catch (e) {
    error('No se pudo registrar la venta')
  } finally {
    guardando.value = false
  }
}
```

- [ ] **Step 4: Actualizar destructuring de `useVentas()`**

En `app/components/clientes/VentaList.vue:7`, reemplazar:

```ts
const { fetchVentasPorCliente, crearVenta, actualizarVenta, eliminarVenta } = useVentas()
```

por:

```ts
const { fetchVentasPorCliente, crearVentas, actualizarVenta, eliminarVenta } = useVentas()
```

- [ ] **Step 5: Reemplazar el template del modal de creación**

En `app/components/clientes/VentaList.vue:260-288`, reemplazar:

```html
    <SharedModal :open="modalNuevaAbierta" titulo="Registrar venta" @cerrar="modalNuevaAbierta = false">
      <div class="space-y-1">
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
        </div>
        <p v-if="errores.fecha" class="text-xs text-red-600">{{ errores.fecha }}</p>
        <p v-if="errores.hora" class="text-xs text-red-600">{{ errores.hora }}</p>

        <button
          :disabled="guardando"
          class="w-full bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 mt-1"
          @click="onSubmit"
        >
          Registrar venta
        </button>
      </div>
    </SharedModal>
```

por:

```html
    <SharedModal :open="modalNuevaAbierta" titulo="Registrar venta" @cerrar="modalNuevaAbierta = false">
      <div class="space-y-3">
        <div v-for="(linea, i) in lineas" :key="i" class="space-y-1">
          <div class="flex items-start gap-2">
            <div class="flex-1 min-w-0">
              <ProductosProductoBuscador v-model="linea.productoId" />
            </div>
            <input
              v-model.number="linea.cantidad"
              type="number"
              min="1"
              step="1"
              title="Cantidad"
              class="w-20 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
            />
            <button
              v-if="lineas.length > 1"
              type="button"
              class="text-gray-300 hover:text-red-600 transition-colors p-2"
              title="Quitar equipo"
              @click="quitarLinea(i)"
            >
              <Icon name="mdi:close" class="w-5 h-5" />
            </button>
          </div>
          <p v-if="erroresLineas[i]" class="text-xs text-red-600">{{ erroresLineas[i] }}</p>
        </div>

        <button
          type="button"
          class="text-sm font-medium text-[#1075B5] hover:text-[#0C5D91] transition-colors"
          @click="agregarLinea"
        >
          + Agregar equipo
        </button>

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
        </div>
        <p v-if="errores.fecha" class="text-xs text-red-600">{{ errores.fecha }}</p>
        <p v-if="errores.hora" class="text-xs text-red-600">{{ errores.hora }}</p>

        <button
          :disabled="guardando"
          class="w-full bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 mt-1"
          @click="onSubmit"
        >
          Registrar venta
        </button>
      </div>
    </SharedModal>
```

- [ ] **Step 6: Build verification**

Run: `npm run build`
Expected: `✨ Build complete!` sin errores (el `errores.productoId` viejo ya no se referencia en ningún lado; `erroresLineas` es el nuevo mecanismo).

- [ ] **Step 7: Commit**

```bash
git add app/components/clientes/VentaList.vue
git commit -m "$(cat <<'EOF'
feat: allow multiple equipo lines with cantidad in nueva venta modal

The create-venta modal went from a single ProductoBuscador to a
dynamic list of {producto, cantidad} lines, starting with one by
default. "+ Agregar equipo" appends a line; the remove button is
hidden on the last remaining line so the form can't reach zero lines.
Submits via the batch crearVentas from the previous commit - one
insert, all lines share the same fecha/hora.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `VentaList.vue` — cantidad en edición y en el historial

**Files:**
- Modify: `app/components/clientes/VentaList.vue`

**Interfaces:**
- Consumes: `Venta.cantidad`, `actualizarVenta` con `cantidad` de Task 2.

- [ ] **Step 1: Agregar estado `cantidadEditada`**

En `app/components/clientes/VentaList.vue:21-26` (bloque de estado de edición), reemplazar:

```ts
const idEditando = ref<string | null>(null)
const productoIdEditado = ref('')
const fechaEditada = ref('')
const horaEditada = ref('')
const valorEditado = ref<number | null>(null)
const guardandoEdicion = ref(false)
```

por:

```ts
const idEditando = ref<string | null>(null)
const productoIdEditado = ref('')
const fechaEditada = ref('')
const horaEditada = ref('')
const valorEditado = ref<number | null>(null)
const cantidadEditada = ref(1)
const guardandoEdicion = ref(false)
```

- [ ] **Step 2: Precargar `cantidadEditada` en `onEditar`**

Reemplazar:

```ts
function onEditar(venta: Venta) {
  idEditando.value = venta.id
  productoIdEditado.value = venta.producto_id
  fechaEditada.value = aFechaInput(venta.fecha)
  horaEditada.value = aHoraInput(venta.fecha)
  valorEditado.value = venta.valor
}
```

por:

```ts
function onEditar(venta: Venta) {
  idEditando.value = venta.id
  productoIdEditado.value = venta.producto_id
  fechaEditada.value = aFechaInput(venta.fecha)
  horaEditada.value = aHoraInput(venta.fecha)
  valorEditado.value = venta.valor
  cantidadEditada.value = venta.cantidad
}
```

- [ ] **Step 3: Validar y enviar `cantidad` en `onGuardarEdicion`**

Reemplazar:

```ts
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
```

por:

```ts
async function onGuardarEdicion(venta: Venta) {
  if (
    !productoIdEditado.value ||
    !fechaEditada.value ||
    !horaEditada.value ||
    !valorEditado.value ||
    valorEditado.value <= 0 ||
    !cantidadEditada.value ||
    cantidadEditada.value < 1
  )
    return
  guardandoEdicion.value = true
  try {
    const actualizada = await actualizarVenta(
      venta.id,
      {
        producto_id: productoIdEditado.value,
        fecha: construirFecha(fechaEditada.value, horaEditada.value),
        valor: valorEditado.value,
        cantidad: cantidadEditada.value,
      },
      venta.version
    )
```

- [ ] **Step 4: Agregar el input de cantidad al template de edición**

En `app/components/clientes/VentaList.vue:184-203`, reemplazar:

```html
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
```

por:

```html
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
            <input
              v-model.number="cantidadEditada"
              type="number"
              min="1"
              step="1"
              title="Cantidad"
              class="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
            />
          </div>
```

- [ ] **Step 5: Mostrar la cantidad en la fila del historial (vista no-edición)**

En `app/components/clientes/VentaList.vue:222-226`, reemplazar:

```html
        <div v-else class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium text-gray-700 truncate">{{ nombreProducto(v.producto_id) }}</p>
            <p class="text-xs text-gray-400">{{ formatearFecha(v.fecha) }} · {{ formatearValor(v.valor) }}</p>
          </div>
```

por:

```html
        <div v-else class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium text-gray-700 truncate">
              {{ nombreProducto(v.producto_id) }}<span v-if="v.cantidad > 1"> ×{{ v.cantidad }}</span>
            </p>
            <p class="text-xs text-gray-400">{{ formatearFecha(v.fecha) }} · {{ formatearValor(v.valor) }}</p>
          </div>
```

- [ ] **Step 6: Build verification**

Run: `npm run build`
Expected: `✨ Build complete!` sin errores.

- [ ] **Step 7: Commit**

```bash
git add app/components/clientes/VentaList.vue
git commit -m "$(cat <<'EOF'
feat: edit cantidad on existing ventas, show it in the history list

Adds a cantidad input next to producto/fecha/hora/valor in the inline
edit block, and shows "×N" next to the product name in the read view
when cantidad > 1 - otherwise the quantity entered at creation would
be invisible after saving.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Verificación manual final (usuario)

**Files:** ninguno — solo checklist.

- [ ] **Step 1: Pasar la checklist de verificación al usuario**

1. Cliente sin ventas: abrir "Registrar venta", confirmar que arranca con
   una sola línea de equipo (comportamiento equivalente al actual).
2. Agregar 2-3 líneas con "+ Agregar equipo", elegir productos distintos,
   poner cantidades distintas (ej: 3 y 1), fecha/hora, guardar — confirmar
   que aparecen todas las filas nuevas en el historial con su "×N"
   correspondiente.
3. Con una sola línea en el modal, confirmar que el botón "✕" no aparece
   (no se puede quitar la última línea).
4. Enviar el form con una línea sin producto seleccionado — confirmar que
   muestra "Selecciona un producto" bajo esa línea y no guarda nada.
5. Editar una venta existente del historial, cambiar la cantidad, guardar —
   confirmar que el "×N" se actualiza en la vista de lista.
6. Editar una venta con cantidad 1 sin cambiarla — confirmar que no muestra
   "×1" en la vista de lista (el sufijo solo aparece si `cantidad > 1`).
