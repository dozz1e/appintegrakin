# Pestaña "Ventas" en detalle de cliente — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una pestaña "Ventas" en `ClienteSplitView.vue` que muestre el historial de ventas del cliente (producto, valor, fecha y hora) y permita registrar una nueva, conectando por primera vez el catálogo de `productos` con `clientes`.

**Architecture:** Tabla nueva `ventas` con `owner_id` (mismo patrón RLS que `tickets`: propio vs `view_all`). Composable `useVentas.ts` (mismo esqueleto que `useTareas.ts`, sin el estado de polling). Componente nuevo `VentaList.vue` (mismo patrón que `TareaList.vue`: formulario de alta + lista de solo lectura, sin editar/borrar). `ClienteSplitView.vue` gana una tercera pestaña junto a "Información"/"Tickets".

**Tech Stack:** Nuxt 4 / Vue 3 `<script setup>` con TypeScript, Supabase (tabla + RLS + permisos vía migraciones SQL, aplicadas con `mcp__supabase__apply_migration`), Tailwind con clases hex directas (`border-gray-200`, `#1075B5`) — mismo estilo que el resto de `app/components/clientes/`.

## Global Constraints

- Sin suite de tests automatizada — la verificación de cada tarea de código es `npm run build`; las migraciones se verifican con `mcp__supabase__execute_sql`.
- Componentes/composables nuevos requieren `rm -rf .nuxt` antes de `npm run dev`/`npm run build` para que el auto-import los detecte.
- Nunca usar `git commit --no-verify` ni saltar hooks.
- Import de tipos con `import type { X } from '~/composables/useX'`.
- `valor` se tipea a mano en cada venta — no hay precio de lista en `productos` para autocompletar (ver spec, "Fuera de alcance").
- Sin edición ni borrado de ventas desde la UI en esta versión — los permisos `ventas.edit`/`ventas.delete` quedan definidos en la RLS por completitud del patrón, pero no se les da acceso a ningún rol en el seed y no hay botones para eso en `VentaList.vue`.
- Ver `docs/superpowers/specs/2026-07-13-ventas-cliente-design.md` para el diseño completo y su razonamiento.

---

### Task 1: Migraciones — tabla, RLS y permisos de `ventas`

**Files:**
- Create: `supabase/migrations/20260713000300_ventas.sql`
- Create: `supabase/migrations/20260713000400_ventas_rls.sql`
- Create: `supabase/migrations/20260713000500_ventas_permisos.sql`

**Interfaces:**
- Consumes: `fn_incrementar_version()` (ya existe, `20260707010000_optimistic_locking.sql`); `registrar_auditoria()` (ya existe, `20260702000800_audit_log.sql`); `has_permission(uuid, text, text)` (ya existe); tablas `clientes`, `productos`, `roles` (ya existen, `productos` desde `20260713000000_productos.sql`); rol `ventas` ya sembrado en `20260702000600_seed_roles_permisos.sql:8`.
- Produces: tabla `ventas(id, cliente_id, producto_id, valor, fecha, owner_id, created_by, created_at, updated_at, version)`; permisos `ventas.view`, `ventas.view_all`, `ventas.create`, `ventas.edit`, `ventas.delete`. Task 2 en adelante consume la tabla y columnas con estos nombres exactos.

- [ ] **Step 1: Crear el archivo de la tabla**

Contenido completo de `supabase/migrations/20260713000300_ventas.sql`:

```sql
-- Primera conexión de productos con otra entidad: registra una venta de
-- un producto del catálogo a un cliente. owner_id = vendedor que la
-- registró, mismo patrón que tickets (propio vs view_all) - ver
-- docs/superpowers/specs/2026-07-13-ventas-cliente-design.md

create table ventas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  producto_id uuid not null references productos(id),
  valor numeric not null,
  fecha timestamptz not null,
  owner_id uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create index idx_ventas_cliente on ventas(cliente_id);
create index idx_ventas_producto on ventas(producto_id);

create trigger trg_ventas_version before update on ventas
  for each row execute function fn_incrementar_version();

create trigger audit_ventas after insert or update or delete on ventas
  for each row execute function registrar_auditoria();
```

- [ ] **Step 2: Crear el archivo de RLS**

Contenido completo de `supabase/migrations/20260713000400_ventas_rls.sql`:

```sql
-- Mismo patrón que tickets (20260702000300_rls_policies.sql:47-63):
-- owner_id distingue "propias" de "todas" - sin política de assign,
-- no aplica reasignar una venta a otro vendedor.

alter table ventas enable row level security;

create policy ventas_select on ventas
for select using (
  has_permission(auth.uid(), 'ventas', 'view_all')
  or (has_permission(auth.uid(), 'ventas', 'view') and owner_id = auth.uid())
);

create policy ventas_insert on ventas
for insert with check (has_permission(auth.uid(), 'ventas', 'create'));

create policy ventas_update on ventas
for update using (
  has_permission(auth.uid(), 'ventas', 'edit')
  and (has_permission(auth.uid(), 'ventas', 'view_all') or owner_id = auth.uid())
);

create policy ventas_delete on ventas
for delete using (has_permission(auth.uid(), 'ventas', 'delete'));
```

- [ ] **Step 3: Crear el archivo de permisos**

Contenido completo de `supabase/migrations/20260713000500_ventas_permisos.sql`:

```sql
insert into permissions (resource, action) values
  ('ventas', 'view'), ('ventas', 'view_all'), ('ventas', 'create'),
  ('ventas', 'edit'), ('ventas', 'delete')
on conflict (resource, action) do nothing;

do $$
declare
  r_id uuid;
  p_id uuid;
  matriz jsonb := '{
    "dueña":      ["ventas.view_all","ventas.create","ventas.edit","ventas.delete"],
    "ventas":     ["ventas.view","ventas.create","ventas.edit"],
    "post_venta": ["ventas.view","ventas.create","ventas.edit"],
    "finanzas":   ["ventas.view_all"],
    "logistica":  ["ventas.view"],
    "operaciones":["ventas.view_all"]
  }';
  rol text;
  perm text;
begin
  for rol in select jsonb_object_keys(matriz) loop
    select id into r_id from roles where name = rol;
    for perm in select jsonb_array_elements_text(matriz->rol) loop
      select id into p_id from permissions
        where resource = split_part(perm, '.', 1) and action = split_part(perm, '.', 2);
      if p_id is not null then
        insert into role_permissions (role_id, permission_id)
        values (r_id, p_id)
        on conflict do nothing;
      end if;
    end loop;
  end loop;
end $$;
```

- [ ] **Step 4: Aplicar las tres migraciones contra la base conectada**

Usar la tool `mcp__supabase__apply_migration` tres veces, en orden, con el contenido exacto de cada archivo de los Steps 1-3 (parámetro `name`: `ventas`, `ventas_rls`, `ventas_permisos`; parámetro `query`: el SQL de cada bloque de arriba).

- [ ] **Step 5: Verificar que la tabla, RLS y permisos quedaron bien**

Correr vía `mcp__supabase__execute_sql`:

```sql
select
  (select count(*) from ventas) as filas_ventas,
  (select relrowsecurity from pg_class where relname = 'ventas') as rls_activo,
  (select count(*) from pg_policies where tablename = 'ventas') as cantidad_policies,
  (select count(*) from permissions where resource = 'ventas') as cantidad_permisos,
  (select count(*) from role_permissions rp
     join roles r on r.id = rp.role_id
     join permissions p on p.id = rp.permission_id
     join roles rv on rv.name = 'ventas'
   where r.id = rv.id and p.resource = 'ventas') as permisos_rol_ventas;
```

Expected: `filas_ventas = 0`, `rls_activo = true`, `cantidad_policies = 4`, `cantidad_permisos = 5`, `permisos_rol_ventas = 3` (view, create, edit).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260713000300_ventas.sql supabase/migrations/20260713000400_ventas_rls.sql supabase/migrations/20260713000500_ventas_permisos.sql
git commit -m "$(cat <<'EOF'
Agregar tabla ventas, RLS y permisos

Primera conexión de productos con clientes. owner_id + RLS propio/
view_all igual que tickets. Permisos ventas.* nuevos - ver
docs/superpowers/specs/2026-07-13-ventas-cliente-design.md
EOF
)"
```

---

### Task 2: `useVentas.ts` — composable de acceso a datos

**Files:**
- Create: `app/composables/useVentas.ts`

**Interfaces:**
- Consumes: `useSupabaseClient()`, `useSupabaseUser()` (auto-import de Nuxt); tabla `ventas` de Task 1.
- Produces: `export interface Venta { id, cliente_id, producto_id, valor, fecha, owner_id, created_by, created_at, updated_at, version }`; `useVentas()` retorna `{ fetchVentasPorCliente, crearVenta }`. Task 3 consume `fetchVentasPorCliente(clienteId: string): Promise<Venta[]>` y `crearVenta(clienteId: string, productoId: string, valor: number, fecha: string): Promise<Venta>`.

- [ ] **Step 1: Escribir el archivo completo**

Crear `app/composables/useVentas.ts` con este contenido:

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

export function useVentas() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  async function fetchVentasPorCliente(clienteId: string): Promise<Venta[]> {
    const { data, error } = await supabase
      .from('ventas')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: false })

    if (error) throw error
    return data ?? []
  }

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

  return { fetchVentasPorCliente, crearVenta }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: termina sin errores (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add app/composables/useVentas.ts
git commit -m "$(cat <<'EOF'
Agregar composable useVentas

fetchVentasPorCliente/crearVenta, mismo esqueleto que useTareas.ts -
ver docs/superpowers/specs/2026-07-13-ventas-cliente-design.md
EOF
)"
```

---

### Task 3: Componente `VentaList.vue`

**Files:**
- Create: `app/components/clientes/VentaList.vue`

**Interfaces:**
- Consumes: `useVentas().fetchVentasPorCliente/crearVenta` (Task 2), `useProductos().fetchProductos` (ya existe), `useToast()` (ya existe), tipos `Venta` desde `~/composables/useVentas` y `Producto` desde `~/composables/useProductos`.
- Produces: componente Vue, auto-importado por Nuxt como `<ClientesVentaList>` (convención `components/clientes/X.vue` → `<ClientesX>`, igual que `ClientesClienteBuscador`). Props: `clienteId: string`. Sin emits. Task 4 lo consume como `<ClientesVentaList :cliente-id="seleccionado.id" />`.

- [ ] **Step 1: Crear el componente**

Crear `app/components/clientes/VentaList.vue` con este contenido completo:

```vue
<script setup lang="ts">
import type { Venta } from '~/composables/useVentas'
import type { Producto } from '~/composables/useProductos'

const props = defineProps<{ clienteId: string }>()

const { fetchVentasPorCliente, crearVenta } = useVentas()
const { fetchProductos } = useProductos()
const { success, error } = useToast()

const ventas = ref<Venta[]>([])
const productos = ref<Producto[]>([])
const cargando = ref(true)
const guardando = ref(false)

const productoId = ref('')
const valor = ref('')
const fecha = ref('')
const hora = ref('')

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

function formatearValor(valor: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor)
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function construirFecha(fecha: string, hora: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const [horas, minutos] = hora.split(':').map(Number)
  return new Date(anio, mes - 1, dia, horas, minutos, 0).toISOString()
}

function validar(): boolean {
  errores.productoId = productoId.value ? '' : 'Selecciona un producto'
  errores.valor = Number(valor.value) > 0 ? '' : 'Ingresa un valor mayor a 0'
  errores.fecha = fecha.value ? '' : 'Ingresa la fecha'
  errores.hora = hora.value ? '' : 'Ingresa la hora'
  return !Object.values(errores).some(Boolean)
}

async function onSubmit() {
  if (!validar()) return
  guardando.value = true
  try {
    await crearVenta(props.clienteId, productoId.value, Number(valor.value), construirFecha(fecha.value, hora.value))
    productoId.value = ''
    valor.value = ''
    fecha.value = ''
    hora.value = ''
    await cargar()
    success('Venta registrada')
  } catch (e) {
    error('No se pudo registrar la venta')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-4 space-y-1">
      <div class="flex flex-wrap gap-2">
        <select
          v-model="productoId"
          class="flex-1 min-w-[10rem] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        >
          <option value="" disabled>Selecciona un producto</option>
          <option v-for="p in productos" :key="p.id" :value="p.id">{{ p.nombre }}</option>
        </select>
        <input
          v-model="valor"
          type="number"
          min="1"
          placeholder="Valor"
          class="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        />
      </div>
      <p v-if="errores.productoId" class="text-xs text-red-600">{{ errores.productoId }}</p>
      <p v-if="errores.valor" class="text-xs text-red-600">{{ errores.valor }}</p>

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
    </div>

    <p v-if="cargando" class="text-sm text-gray-400">Cargando ventas...</p>
    <p v-else-if="!ventas.length" class="text-sm text-gray-400">Sin ventas todavía.</p>

    <ul v-else class="space-y-2">
      <li
        v-for="v in ventas"
        :key="v.id"
        class="flex items-center justify-between gap-3 p-2 rounded-lg bg-gray-50 text-sm"
      >
        <div class="min-w-0">
          <p class="font-medium text-gray-700 truncate">{{ nombreProducto(v.producto_id) }}</p>
          <p class="text-xs text-gray-400">{{ formatearFecha(v.fecha) }}</p>
        </div>
        <span class="font-medium text-gray-700 shrink-0">{{ formatearValor(v.valor) }}</span>
      </li>
    </ul>
  </div>
</template>
```

Nota sobre `errores.productoId`/`nombreProducto(productoId: string)`: el parámetro de la función local `nombreProducto` sombrea intencionalmente el `ref productoId` del formulario — son ámbitos distintos (uno es parámetro de función, el otro variable de módulo del `<script setup>`), mismo estilo compacto que ya usa el resto del repo (ej. `formatearFecha(fecha: string)` en `TareaList.vue` sombreando conceptualmente el campo `fecha_vencimiento`).

- [ ] **Step 2: Verificar que compila**

Run: `rm -rf .nuxt && npm run build`
Expected: termina sin errores. Si Nuxt no reconoce `<ClientesVentaList>` más adelante (Task 4), confirmar que el archivo quedó en `app/components/clientes/VentaList.vue` exactamente.

- [ ] **Step 3: Commit**

```bash
git add app/components/clientes/VentaList.vue
git commit -m "$(cat <<'EOF'
Agregar componente VentaList

Alta de venta (producto/valor/fecha/hora) + historial de solo lectura,
mismo patrón que TareaList.vue - ver
docs/superpowers/specs/2026-07-13-ventas-cliente-design.md
EOF
)"
```

---

### Task 4: Integrar la pestaña "Ventas" en `ClienteSplitView.vue`

**Files:**
- Modify: `app/components/clientes/ClienteSplitView.vue`

**Interfaces:**
- Consumes: `<ClientesVentaList :cliente-id="..." />` (Task 3), `usePermissions().can` (ya usado en el archivo).
- Produces: nada nuevo — `ClienteSplitView.vue` no expone interfaz a otros archivos.

- [ ] **Step 1: Ampliar el tipo de `tabActiva` y agregar `puedeVerVentas`**

En `app/components/clientes/ClienteSplitView.vue`, la línea:

```ts
const tabActiva = ref<'info' | 'tickets'>('info')
```

pasa a:

```ts
const tabActiva = ref<'info' | 'tickets' | 'ventas'>('info')
```

Justo después de la línea `const puedeVerTickets = computed(() => can('tickets', 'view') || can('tickets', 'view_all'))`, agregar:

```ts
const puedeVerVentas = computed(() => can('ventas', 'view') || can('ventas', 'view_all'))
```

- [ ] **Step 2: Agregar el botón de la pestaña "Ventas"**

El bloque de tabs actual es:

```html
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
```

Reemplazar por:

```html
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
          <button
            v-if="puedeVerVentas"
            type="button"
            class="text-sm font-medium pb-2 border-b-2 transition-colors"
            :class="tabActiva === 'ventas' ? 'border-[#1075B5] text-[#1075B5]' : 'border-transparent text-gray-400 hover:text-gray-600'"
            @click="tabActiva = 'ventas'"
          >
            Ventas
          </button>
        </div>
```

- [ ] **Step 3: Convertir el `v-else` de tickets en `v-else-if` y agregar el bloque de ventas**

El bloque actual (cierra la cadena de tabs) es:

```html
        <div v-if="tabActiva === 'info'" class="space-y-4">
```
... (contenido de información, sin cambios) ...
```html
        <div v-else>
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-semibold text-gray-700">Tickets de servicio técnico</p>
```
... (contenido de tickets, sin cambios) ...
```html
          <p v-else class="text-sm text-gray-400">Sin tickets todavía</p>
        </div>
      </div>
    </div>
```

Cambiar únicamente la etiqueta de apertura del bloque de tickets, de:

```html
        <div v-else>
```

a:

```html
        <div v-else-if="tabActiva === 'tickets'">
```

E inmediatamente después del `</div>` que cierra ese bloque de tickets (el que sigue a `<p v-else class="text-sm text-gray-400">Sin tickets todavía</p>`), agregar el bloque de ventas:

```html
        <div v-else-if="tabActiva === 'ventas'">
          <p class="text-sm font-semibold text-gray-700 mb-3">Ventas</p>
          <ClientesVentaList :cliente-id="seleccionado.id" />
        </div>
```

El `</div>` final que cierra el contenedor blanco (`bg-white border border-gray-100 rounded-2xl shadow-sm p-5`) queda exactamente donde estaba, ahora después de este nuevo bloque.

- [ ] **Step 4: Verificar que compila**

Run: `rm -rf .nuxt && npm run build`
Expected: termina sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/components/clientes/ClienteSplitView.vue
git commit -m "$(cat <<'EOF'
Agregar pestaña Ventas al detalle de cliente

Tercera pestaña junto a Información/Tickets en ClienteSplitView,
visible según permiso ventas.view/view_all - ver
docs/superpowers/specs/2026-07-13-ventas-cliente-design.md
EOF
)"
```

---

### Task 5: Verificación end-to-end

**Files:**
- Ninguno (solo verificación manual, sin cambios de código).

**Interfaces:**
- Consumes: todo lo de Tasks 1-4.
- Produces: nada — cierre del feature.

- [ ] **Step 1: Build final**

Run: `rm -rf .nuxt && npm run build`
Expected: termina sin errores.

- [ ] **Step 2: Verificación manual end-to-end**

Run: `npm run dev`, iniciar sesión con un usuario que tenga permiso `ventas.create` (por ejemplo el rol `dueña`, que lo tiene por el seed de Task 1), entrar a `/clientes`, y verificar cada punto de la sección "Testing" del spec (`docs/superpowers/specs/2026-07-13-ventas-cliente-design.md`):

1. Seleccionar un cliente de la lista: aparece la pestaña "Ventas" junto a "Información" y "Tickets".
2. Click en "Ventas": se ve el formulario de alta (selector de producto con el catálogo completo, valor, fecha, hora) y, debajo, el historial (vacío si no hay ventas todavía para ese cliente).
3. Completar el formulario con un producto real, un valor, y fecha/hora actuales, y registrar: la venta aparece de inmediato en el historial, arriba de todo, con el nombre del producto, el valor formateado como moneda CLP, y la fecha/hora correctas.
4. Registrar una segunda venta con una fecha anterior a la primera: queda ordenada después (la más reciente siempre arriba).
5. Intentar registrar sin seleccionar producto, o con valor vacío/0, o sin fecha/hora: no se envía, aparece el mensaje de error correspondiente bajo cada campo inválido.
6. Cambiar de cliente en la lista de la izquierda: la pestaña activa vuelve a "Información" (comportamiento ya existente del watcher de `seleccionadoId`) y, si se vuelve a entrar a "Ventas", el historial mostrado es el del nuevo cliente seleccionado, no el del anterior.
7. Si el catálogo de productos está vacío (`/productos` sin filas), el selector de producto en el formulario de ventas no tiene opciones más allá de "Selecciona un producto" — confirmar que no rompe nada, solo que no se puede registrar una venta hasta cargar al menos un producto.

Si el entorno donde se ejecuta este plan no tiene forma de autenticarse contra Supabase, documentar cuáles de estos puntos se pudieron verificar (al menos el build y que el dev server levanta sin errores de consola) y pedirle al usuario que confirme el resto manualmente antes de dar la tarea por cerrada.

- [ ] **Step 3: Actualizar `CONTEXTO_PROYECTO.md` si corresponde**

Si `CONTEXTO_PROYECTO.md` mantiene una lista de módulos/tablas del sistema (revisar su sección de estructura de base de datos), agregar una línea para `ventas` siguiendo el mismo formato que la entrada de `productos`. Si no existe tal lista o `productos` no quedó documentado ahí tampoco, omitir este paso.

---

## Cierre

Al terminar las 5 tareas, confirmar con `git log --oneline -8` que quedaron los commits de Tasks 1-4 (más el del spec ya existente) y avisarle al usuario que confirme el push a `origin/master`.
