# Catálogo de Productos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un módulo de catálogo de productos (tabla `productos` + composable + vista de lista con búsqueda/filtros + alta/edición + import/export CSV), como catálogo independiente sin relación con clientes/leads/tickets.

**Architecture:** Migración SQL nueva (tabla + RLS + permisos, aplicada vía el MCP de Supabase) siguiendo exactamente el patrón ya usado por clientes/leads/tickets (optimistic locking con `version`, trigger de auditoría genérico ya existente). Composable `useProductos.ts` calcado de `useClientes.ts`. Tres páginas nuevas (`/productos`, `/productos/nuevo`, `/productos/[id]`) siguiendo el patrón de páginas de clientes, sin panel dividido ni tablero — una tabla simple con filtros client-side, porque el catálogo se trae completo de una sola vez (sin paginación server-side).

**Tech Stack:** Nuxt 4 / Vue 3, TypeScript, Supabase JS client, Tailwind. Sin framework de tests instalado — verificación vía `npm run build` (type-check) y testing manual en navegador. Migraciones aplicadas directamente contra la base conectada vía las tools `mcp__supabase__apply_migration` / `mcp__supabase__execute_sql` (este proyecto no corre un stack local de Supabase).

## Global Constraints

- SKU único (constraint `unique` en la base), igual que `clientes.rut`.
- Categoría y unidad de medida son texto libre, sin catálogo fijo de valores.
- Sin relación con clientes/leads/tickets en esta versión — módulo 100% independiente.
- Sin paginación server-side: la tabla trae el catálogo completo con `fetchProductos()` y filtra client-side (búsqueda, categoría, estado).
- Permisos nuevos (`productos.view`, `view_all`, `create`, `edit`, `delete`) se le dan por defecto solo al rol `dueña`; el resto de roles queda sin acceso hasta que se activen manualmente desde `/admin/permisos`.
- El trigger de auditoría genérico (`registrar_auditoria()`) y el de optimistic locking (`fn_incrementar_version()`) ya existen — se reutilizan sin modificarlos, solo se enganchan a la tabla nueva.
- Usar `node`/`npm` del sistema (no `bun`) para cualquier comando.
- Spec completo en `docs/superpowers/specs/2026-07-12-productos-catalogo-design.md` — cualquier duda sobre una decisión de producto se resuelve ahí.

---

### Task 1: Migraciones — tabla, RLS y permisos de `productos`

**Files:**
- Create: `supabase/migrations/20260713000000_productos.sql`
- Create: `supabase/migrations/20260713000100_productos_rls.sql`
- Create: `supabase/migrations/20260713000200_productos_permisos.sql`

**Interfaces:**
- Consumes: función `fn_incrementar_version()` (ya existe, `supabase/migrations/20260707010000_optimistic_locking.sql`); función `registrar_auditoria()` (ya existe, `supabase/migrations/20260702000800_audit_log.sql`); función `has_permission(uuid, text, text)` (ya existe, usada por todas las políticas RLS del proyecto); tabla `roles` con la fila `name = 'dueña'` (ya existe, sembrada en `20260702000600_seed_roles_permisos.sql`).
- Produces: tabla `productos(id, nombre, sku, categoria, unidad_medida, estado, created_by, created_at, updated_at, version)`; permisos `productos.view`, `productos.view_all`, `productos.create`, `productos.edit`, `productos.delete` en la tabla `permissions`, con el rol `dueña` teniendo `view_all/create/edit/delete` en `role_permissions`. Task 2 en adelante consume la tabla y las columnas exactamente con estos nombres.

- [ ] **Step 1: Crear el archivo de la tabla**

Contenido completo de `supabase/migrations/20260713000000_productos.sql`:

```sql
-- Catálogo de productos: sin owner_id (no es "propiedad" de un vendedor,
-- es un catálogo compartido) — ver
-- docs/superpowers/specs/2026-07-12-productos-catalogo-design.md

create table productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  sku text not null unique,
  categoria text,
  unidad_medida text,
  estado text check (estado in ('activo','inactivo')) default 'activo',
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  version integer not null default 1
);

create index idx_productos_categoria on productos(categoria);
create index idx_productos_estado on productos(estado);

create trigger trg_productos_version before update on productos
  for each row execute function fn_incrementar_version();

create trigger audit_productos after insert or update or delete on productos
  for each row execute function registrar_auditoria();
```

- [ ] **Step 2: Crear el archivo de RLS**

Contenido completo de `supabase/migrations/20260713000100_productos_rls.sql`:

```sql
-- Sin distinción propio/todos (no hay owner_id): view y view_all se
-- comportan igual, ambos ven el catálogo completo. Se mantienen como
-- permisos separados por consistencia con el resto de recursos del
-- sistema de permisos (RBAC ya asume ese par view/view_all en la UI).

alter table productos enable row level security;

create policy productos_select on productos
for select using (
  has_permission(auth.uid(), 'productos', 'view_all')
  or has_permission(auth.uid(), 'productos', 'view')
);

create policy productos_insert on productos
for insert with check (has_permission(auth.uid(), 'productos', 'create'));

create policy productos_update on productos
for update using (has_permission(auth.uid(), 'productos', 'edit'));

create policy productos_delete on productos
for delete using (has_permission(auth.uid(), 'productos', 'delete'));
```

- [ ] **Step 3: Crear el archivo de permisos**

Contenido completo de `supabase/migrations/20260713000200_productos_permisos.sql`:

```sql
insert into permissions (resource, action) values
  ('productos', 'view'), ('productos', 'view_all'), ('productos', 'create'),
  ('productos', 'edit'), ('productos', 'delete')
on conflict (resource, action) do nothing;

do $$
declare
  r_id uuid;
  p_id uuid;
  perm text;
begin
  select id into r_id from roles where name = 'dueña';
  for perm in select unnest(array[
    'productos.view_all','productos.create','productos.edit','productos.delete'
  ]) loop
    select id into p_id from permissions
      where resource = split_part(perm, '.', 1) and action = split_part(perm, '.', 2);
    if p_id is not null then
      insert into role_permissions (role_id, permission_id)
      values (r_id, p_id)
      on conflict do nothing;
    end if;
  end loop;
end $$;
```

- [ ] **Step 4: Aplicar las tres migraciones contra la base conectada**

Usar la tool `mcp__supabase__apply_migration` tres veces, en orden, con el contenido exacto de cada archivo de los Steps 1-3 (parámetro `name`: `productos`, `productos_rls`, `productos_permisos`; parámetro `query`: el SQL de cada bloque de arriba).

- [ ] **Step 5: Verificar que la tabla, RLS y permisos quedaron bien**

Correr vía `mcp__supabase__execute_sql`:

```sql
select
  (select count(*) from productos) as filas_productos,
  (select relrowsecurity from pg_class where relname = 'productos') as rls_activo,
  (select count(*) from pg_policies where tablename = 'productos') as cantidad_policies,
  (select count(*) from permissions where resource = 'productos') as cantidad_permisos,
  (select count(*) from role_permissions rp
     join roles r on r.id = rp.role_id
     join permissions p on p.id = rp.permission_id
   where r.name = 'dueña' and p.resource = 'productos') as permisos_duena;
```

Expected: `filas_productos = 0`, `rls_activo = true`, `cantidad_policies = 4`, `cantidad_permisos = 5`, `permisos_duena = 4`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260713000000_productos.sql supabase/migrations/20260713000100_productos_rls.sql supabase/migrations/20260713000200_productos_permisos.sql
git commit -m "$(cat <<'EOF'
Agregar tabla productos, RLS y permisos

Catálogo independiente (sin owner_id, sin relación con clientes/leads/
tickets). Reutiliza los triggers genéricos de optimistic locking y
auditoría ya existentes. Permisos productos.* nuevos, otorgados por
defecto solo al rol dueña.
EOF
)"
```

---

### Task 2: `useProductos.ts` — composable de acceso a datos

**Files:**
- Create: `app/composables/useProductos.ts`

**Interfaces:**
- Consumes: `useSupabaseClient()` (auto-import de Nuxt, patrón ya usado en `useClientes.ts`); tabla `productos` de Task 1.
- Produces: `export type EstadoProducto = 'activo' | 'inactivo'`; `export interface Producto { id, nombre, sku, categoria, unidad_medida, estado, created_by, created_at, updated_at, version }`; `useProductos()` retorna `{ fetchProductos, getProducto, createProducto, updateProducto, deleteProducto, importProductos }`. Task 3 y Task 4 importan `Producto`/`EstadoProducto` de este archivo y llaman estas funciones con esta firma exacta.

- [ ] **Step 1: Escribir el archivo completo**

```ts
// composables/useProductos.ts
// Catálogo compartido, sin owner_id - RLS ya filtra qué puede ver/editar
// cada usuario según sus permisos (no se reimplementa acá).

export type EstadoProducto = 'activo' | 'inactivo'

export interface Producto {
  id: string
  nombre: string
  sku: string
  categoria: string | null
  unidad_medida: string | null
  estado: EstadoProducto
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
}

export const useProductos = () => {
  const supabase = useSupabaseClient()

  const fetchProductos = async () => {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('nombre', { ascending: true })
    if (error) throw error
    return data as Producto[]
  }

  const getProducto = async (id: string) => {
    const { data, error } = await supabase.from('productos').select('*').eq('id', id).single()
    if (error) throw error
    return data as Producto
  }

  const createProducto = async (payload: Partial<Producto>) => {
    const { data, error } = await supabase.from('productos').insert(payload).select().single()
    if (error) throw error
    return data as Producto
  }

  const updateProducto = async (id: string, payload: Partial<Producto>, expectedVersion?: number) => {
    let query = supabase
      .from('productos')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (expectedVersion !== undefined) query = query.eq('version', expectedVersion)

    const { data, error } = await query.select().maybeSingle()
    if (error) throw error

    if (expectedVersion !== undefined && !data) {
      throw new Error('CONFLICTO_VERSION')
    }
    return data as Producto
  }

  const deleteProducto = async (id: string) => {
    const { error } = await supabase.from('productos').delete().eq('id', id)
    if (error) throw error
  }

  // Importación masiva con deduplicación por SKU (columna unique) - mismo
  // patrón que importClientes/importLeads. Filas sin sku o sin nombre se
  // descartan antes de intentar el insert.
  const importProductos = async (filas: Record<string, string>[]) => {
    const candidatos = filas
      .filter((f) => f.sku?.trim() && f.nombre?.trim())
      .map((f) => ({
        sku: f.sku.trim(),
        nombre: f.nombre.trim(),
        categoria: f.categoria?.trim() || null,
        unidad_medida: f.unidad_medida?.trim() || null,
        estado: (f.estado?.trim().toLowerCase() === 'inactivo' ? 'inactivo' : 'activo') as EstadoProducto,
      }))

    if (!candidatos.length) return { insertados: 0, omitidos: filas.length }

    const { data, error } = await supabase
      .from('productos')
      .upsert(candidatos, { onConflict: 'sku', ignoreDuplicates: true })
      .select()

    if (error) throw error

    const insertados = data?.length ?? 0
    return { insertados, omitidos: filas.length - insertados }
  }

  return { fetchProductos, getProducto, createProducto, updateProducto, deleteProducto, importProductos }
}
```

- [ ] **Step 2: Verificar que el build pasa**

Run: `npm run build`
Expected: build termina sin errores de TypeScript. Este archivo no es consumido por ninguna página todavía, así que el build debe pasar limpio (no hay errores esperados como en otros planes donde una página quedaba temporalmente desincronizada).

- [ ] **Step 3: Commit**

```bash
git add app/composables/useProductos.ts
git commit -m "$(cat <<'EOF'
Agregar composable useProductos

CRUD completo (fetch/get/create/update con optimistic locking/delete) e
importación masiva con dedup por SKU, mismo patrón que useClientes.ts.
EOF
)"
```

---

### Task 3: Alta y edición de productos (`ProductoForm.vue`, `nuevo.vue`, `[id].vue`)

**Files:**
- Create: `app/components/productos/ProductoForm.vue`
- Create: `app/pages/productos/nuevo.vue`
- Create: `app/pages/productos/[id].vue`

**Interfaces:**
- Consumes: `Producto`, `EstadoProducto` y `useProductos()` (`createProducto`, `getProducto`, `updateProducto`, `deleteProducto`) de Task 2; `usePermissions().can` (ya existe, sin cambios); `useToast()` (ya existe, sin cambios); `SharedPageHeader`, `SharedCard`, `SharedConfirmDialog` (ya existen, sin cambios, mismo uso que en `clientes/[id].vue`).
- Produces: componente auto-importado `<ProductosProductoForm>` (por convención de carpetas de Nuxt, `app/components/productos/ProductoForm.vue` → `ProductosProductoForm`), que emite `submit: [payload: Partial<Producto>]`; rutas `/productos/nuevo` y `/productos/[id]`. Task 4 no depende de estos archivos (son independientes entre sí salvo por importar `Producto` de Task 2).

- [ ] **Step 1: Escribir `ProductoForm.vue`**

```vue
<script setup lang="ts">
import type { Producto } from '~/composables/useProductos'

const props = defineProps<{ modelValue?: Partial<Producto>; cargando?: boolean; mostrarEstado?: boolean }>()
const emit = defineEmits<{ submit: [payload: Partial<Producto>] }>()

const form = reactive<Partial<Producto>>({
  nombre: props.modelValue?.nombre ?? '',
  sku: props.modelValue?.sku ?? '',
  categoria: props.modelValue?.categoria ?? '',
  unidad_medida: props.modelValue?.unidad_medida ?? '',
  estado: props.modelValue?.estado ?? 'activo',
})

const activo = computed({
  get: () => form.estado !== 'inactivo',
  set: (val: boolean) => {
    form.estado = val ? 'activo' : 'inactivo'
  },
})

const errores = reactive<Record<string, string>>({})

const validar = () => {
  errores.nombre = form.nombre ? '' : 'El nombre es obligatorio'
  errores.sku = form.sku ? '' : 'El SKU es obligatorio'
  return !Object.values(errores).some(Boolean)
}

const onSubmit = () => {
  if (!validar()) return
  emit('submit', { ...form })
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Nombre *</label>
      <input
        v-model="form.nombre"
        type="text"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
      <p v-if="errores.nombre" class="text-sm text-red-600 mt-1">{{ errores.nombre }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">SKU *</label>
      <input
        v-model="form.sku"
        type="text"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
      <p v-if="errores.sku" class="text-sm text-red-600 mt-1">{{ errores.sku }}</p>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Categoría</label>
        <input
          v-model="form.categoria"
          type="text"
          class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
        />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Unidad de medida</label>
        <input
          v-model="form.unidad_medida"
          type="text"
          class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
        />
      </div>
    </div>

    <div v-if="mostrarEstado" class="flex items-center gap-2">
      <input v-model="activo" type="checkbox" class="w-4 h-4 accent-[#1075B5]" />
      <label class="text-sm text-gray-700">Activo</label>
    </div>

    <button
      type="submit"
      :disabled="cargando"
      class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {{ cargando ? 'Guardando...' : 'Guardar producto' }}
    </button>
  </form>
</template>
```

- [ ] **Step 2: Escribir `app/pages/productos/nuevo.vue`**

```vue
<script setup lang="ts">
definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'productos', actions: ['create'] },
})

const { createProducto } = useProductos()
const router = useRouter()
const { success, error } = useToast()
const cargando = ref(false)

const onSubmit = async (payload: Record<string, unknown>) => {
  cargando.value = true
  try {
    const producto = await createProducto(payload)
    success('Producto creado correctamente')
    await router.push(`/productos/${producto.id}`)
  } catch (e: any) {
    if (e.code === '23505') {
      error('Ya existe un producto con ese SKU.')
    } else {
      error('No se pudo crear el producto. Intenta de nuevo.')
    }
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-lg">
    <SharedPageHeader titulo="Nuevo producto" volver-a="/productos" />
    <SharedCard>
      <ProductosProductoForm :cargando="cargando" @submit="onSubmit" />
    </SharedCard>
  </div>
</template>
```

- [ ] **Step 3: Escribir `app/pages/productos/[id].vue`**

```vue
<script setup lang="ts">
import type { Producto } from '~/composables/useProductos'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'productos', actions: ['view', 'view_all'] },
})

const route = useRoute()
const { getProducto, updateProducto, deleteProducto } = useProductos()
const { can } = usePermissions()
const { success, error } = useToast()

const producto = ref<Producto | null>(null)
const cargando = ref(true)
const guardando = ref(false)
const confirmandoEliminar = ref(false)
const eliminando = ref(false)

onMounted(async () => {
  producto.value = await getProducto(route.params.id as string)
  cargando.value = false
})

const onSubmit = async (payload: Record<string, unknown>) => {
  if (!producto.value) return
  guardando.value = true
  try {
    producto.value = await updateProducto(producto.value.id, payload, producto.value.version)
    success('Producto actualizado')
  } catch (e: any) {
    if (e.code === '23505') {
      error('Ya existe un producto con ese SKU.')
    } else if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este producto mientras lo tenías abierto. Se recargaron los datos actuales, revisa e intenta de nuevo.')
      producto.value = await getProducto(route.params.id as string)
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  } finally {
    guardando.value = false
  }
}

async function onConfirmarEliminar() {
  if (!producto.value) return
  eliminando.value = true
  try {
    await deleteProducto(producto.value.id)
    success('Producto eliminado')
    await navigateTo('/productos')
  } catch (e) {
    error('No se pudo eliminar el producto. Intenta de nuevo.')
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-lg">
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <template v-else-if="producto">
      <SharedPageHeader :titulo="producto.nombre" volver-a="/productos" />

      <SharedCard>
        <ProductosProductoForm
          :model-value="producto"
          :cargando="guardando"
          mostrar-estado
          @submit="(payload) => (can('productos', 'edit') ? onSubmit(payload) : undefined)"
        />
      </SharedCard>

      <div v-if="can('productos', 'delete')" class="mt-6">
        <SharedCard>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold text-gray-700">Eliminar producto</h2>
              <p class="text-xs text-gray-400 mt-1">Esta acción no se puede deshacer.</p>
            </div>
            <button
              type="button"
              class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              @click="confirmandoEliminar = true"
            >
              Eliminar producto
            </button>
          </div>
        </SharedCard>
      </div>

      <SharedConfirmDialog
        :open="confirmandoEliminar"
        titulo="Eliminar producto"
        :mensaje="`¿Eliminar ${producto.nombre}? Esta acción no se puede deshacer.`"
        :cargando="eliminando"
        @confirmar="onConfirmarEliminar"
        @cancelar="confirmandoEliminar = false"
      />
    </template>
    <p v-else class="text-red-600">Producto no encontrado</p>
  </div>
</template>
```

- [ ] **Step 4: Verificar que el build pasa**

Run: `npm run build`
Expected: build termina sin errores de TypeScript/Vue. Nota: en este punto `/productos` (el listado, Task 4) todavía no existe, así que los `volver-a="/productos"` y `router.push`/`navigateTo` a `/productos` apuntan a una ruta que da 404 en runtime — esto es esperado hasta Task 4 y no rompe el build (Nuxt no valida rutas en build time).

- [ ] **Step 5: Commit**

```bash
git add app/components/productos/ProductoForm.vue app/pages/productos/nuevo.vue app/pages/productos/[id].vue
git commit -m "$(cat <<'EOF'
Agregar alta y edición de productos

ProductoForm.vue (nombre/sku obligatorios, categoría/unidad libres,
toggle activo/inactivo solo al editar) + páginas nuevo.vue y [id].vue,
mismo patrón que clientes. Maneja conflicto de SKU duplicado (23505) y
de versión concurrente (optimistic locking) con mensajes específicos.
EOF
)"
```

---

### Task 4: Listado de productos (`productos/index.vue`) con búsqueda, filtros e import/export CSV

**Files:**
- Create: `app/pages/productos/index.vue`

**Interfaces:**
- Consumes: `Producto` y `useProductos()` (`fetchProductos`, `importProductos`) de Task 2; `usePermissions().can`, `useCsv()` (`parsearCSV`, `descargarCSV` — ya existe, sin cambios), `useToast()` (ya existen, sin cambios); `SharedPageHeader`, `SharedBadge` (ya existen, sin cambios, mismo uso que en `clientes/index.vue` y `admin/auditoria/index.vue`).
- Produces: ruta `/productos` (el listado enlazado por `volver-a` y los `push`/`navigateTo` de Task 3). Último task funcional del plan — Task 5 solo agrega navegación y no depende de nada nuevo de acá salvo la ruta ya existir.

- [ ] **Step 1: Escribir `app/pages/productos/index.vue`**

```vue
<script setup lang="ts">
import type { Producto } from '~/composables/useProductos'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'productos', actions: ['view', 'view_all'] },
})

const { fetchProductos, importProductos } = useProductos()
const { can } = usePermissions()
const { parsearCSV, descargarCSV } = useCsv()
const { success, error } = useToast()

const productos = ref<Producto[]>([])
const cargando = ref(true)
const importando = ref(false)
const inputArchivo = ref<HTMLInputElement | null>(null)

const busqueda = ref('')
const filtroCategoria = ref('')
const filtroEstado = ref<'' | 'activo' | 'inactivo'>('')

onMounted(async () => {
  productos.value = await fetchProductos()
  cargando.value = false
})

const categorias = computed(() =>
  [...new Set(productos.value.map((p) => p.categoria).filter((c): c is string => !!c))].sort()
)

const productosFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  return productos.value.filter((p) => {
    if (q && !p.nombre.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false
    if (filtroCategoria.value && p.categoria !== filtroCategoria.value) return false
    if (filtroEstado.value && p.estado !== filtroEstado.value) return false
    return true
  })
})

const colorEstado: Record<string, string> = {
  activo: 'bg-green-50 text-green-700',
  inactivo: 'bg-gray-100 text-gray-500',
}

function onExportar() {
  const filas = productos.value.map((p) => ({
    nombre: p.nombre,
    sku: p.sku,
    categoria: p.categoria ?? '',
    unidad_medida: p.unidad_medida ?? '',
    estado: p.estado,
  }))
  descargarCSV('productos', filas)
}

async function onArchivoSeleccionado(e: Event) {
  const archivo = (e.target as HTMLInputElement).files?.[0]
  if (!archivo) return

  importando.value = true
  try {
    const filas = await parsearCSV(archivo)
    const { insertados, omitidos } = await importProductos(filas)
    success(`${insertados} productos importados${omitidos ? `, ${omitidos} omitidos (duplicados o incompletos)` : ''}`)
    productos.value = await fetchProductos()
  } catch (e) {
    error('No se pudo importar el archivo. Revisa el formato del CSV.')
  } finally {
    importando.value = false
    if (inputArchivo.value) inputArchivo.value.value = ''
  }
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Productos">
      <template #accion>
        <div class="flex items-center gap-2">
          <button
            class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            @click="onExportar"
          >
            Exportar CSV
          </button>
          <button
            v-if="can('productos', 'create')"
            :disabled="importando"
            class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            @click="inputArchivo?.click()"
          >
            {{ importando ? 'Importando...' : 'Importar CSV' }}
          </button>
          <input ref="inputArchivo" type="file" accept=".csv" class="hidden" @change="onArchivoSeleccionado" />
          <NuxtLink
            v-if="can('productos', 'create')"
            to="/productos/nuevo"
            class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Nuevo producto
          </NuxtLink>
        </div>
      </template>
    </SharedPageHeader>

    <div class="flex flex-wrap gap-2 mb-4">
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por nombre o SKU..."
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
      <select v-model="filtroCategoria" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30">
        <option value="">Todas las categorías</option>
        <option v-for="c in categorias" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="filtroEstado" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30">
        <option value="">Todos los estados</option>
        <option value="activo">Activo</option>
        <option value="inactivo">Inactivo</option>
      </select>
    </div>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="productosFiltrados.length === 0" class="p-10 text-center text-gray-400">
        {{ busqueda || filtroCategoria || filtroEstado ? 'Sin resultados para estos filtros' : 'Sin productos todavía' }}
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Nombre</th>
            <th class="px-4 py-3 font-medium">SKU</th>
            <th class="px-4 py-3 font-medium">Categoría</th>
            <th class="px-4 py-3 font-medium">Unidad</th>
            <th class="px-4 py-3 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr
            v-for="p in productosFiltrados"
            :key="p.id"
            class="cursor-pointer hover:bg-gray-50"
            @click="navigateTo(`/productos/${p.id}`)"
          >
            <td class="px-4 py-3 text-gray-700 font-medium">{{ p.nombre }}</td>
            <td class="px-4 py-3 text-gray-500">{{ p.sku }}</td>
            <td class="px-4 py-3 text-gray-500">{{ p.categoria || '—' }}</td>
            <td class="px-4 py-3 text-gray-500">{{ p.unidad_medida || '—' }}</td>
            <td class="px-4 py-3">
              <SharedBadge :label="p.estado === 'activo' ? 'Activo' : 'Inactivo'" :clases="colorEstado[p.estado]" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Verificar que el build pasa**

Run: `npm run build`
Expected: build termina sin errores de TypeScript/Vue.

- [ ] **Step 3: Commit**

```bash
git add app/pages/productos/index.vue
git commit -m "$(cat <<'EOF'
Agregar listado de productos con búsqueda, filtros e import/export CSV

Tabla con búsqueda por nombre/SKU y filtros por categoría/estado,
100% client-side sobre el catálogo completo (sin paginación
server-side). Botones Exportar/Importar CSV y "+ Nuevo producto",
mismo patrón que clientes/leads.
EOF
)"
```

---

### Task 5: Navegación, integración con auditoría y verificación end-to-end

**Files:**
- Modify: `app/layouts/default.vue`
- Modify: `app/pages/admin/auditoria/index.vue`

**Interfaces:**
- Consumes: ruta `/productos` (Task 4); `navCrm` array ya existente en `default.vue`; selector `filtroTabla` ya existente en `admin/auditoria/index.vue` (ver `docs/superpowers/specs/2026-07-12-auditoria-filtros-paginacion-design.md`).
- Produces: nada — último task del plan.

- [ ] **Step 1: Agregar el ítem de navegación**

En `app/layouts/default.vue`, el array `navCrm` (línea ~17-21) queda:

```ts
const navCrm = [
  { path: '/clientes', label: 'Clientes', permiso: ['view', 'view_all'] as const, resource: 'clientes' },
  { path: '/leads', label: 'Leads', permiso: ['view', 'view_all'] as const, resource: 'leads' },
  { path: '/tickets', label: 'Tickets', permiso: ['view', 'view_all'] as const, resource: 'tickets' },
  { path: '/productos', label: 'Productos', permiso: ['view', 'view_all'] as const, resource: 'productos' },
]
```

- [ ] **Step 2: Agregar "Productos" al filtro de tabla de auditoría**

En `app/pages/admin/auditoria/index.vue`, dentro del `<select v-model="filtroTabla">`, agregar una opción junto a las existentes (clientes/leads/tickets):

```html
<select v-model="filtroTabla" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30">
  <option value="">Todas las tablas</option>
  <option value="clientes">Clientes</option>
  <option value="leads">Leads</option>
  <option value="tickets">Tickets</option>
  <option value="productos">Productos</option>
</select>
```

- [ ] **Step 3: Verificar que el build pasa**

Run: `npm run build`
Expected: build termina sin errores de TypeScript/Vue.

- [ ] **Step 4: Testing manual en navegador**

Con `npm run dev` corriendo (verificar si ya hay uno con `ps aux | grep "npm run dev"` antes de levantar uno nuevo — este proyecto ha tenido problemas con múltiples instancias compitiendo por el puerto), loguearse con un usuario del rol `dueña` (o el único perfil existente hoy, `o.molina@integrakin.cl`, si tiene ese rol) y verificar contra la spec (`docs/superpowers/specs/2026-07-12-productos-catalogo-design.md`, sección "Testing"):

1. El sidebar muestra "Productos" en la sección CRM; entrar a `/productos` no redirige a `/403`.
2. Crear un producto con nombre y SKU → aparece en la lista, estado `activo` por defecto (sin toggle visible en el formulario de creación).
3. Crear un producto con un SKU que ya existe → aparece el toast de error "Ya existe un producto con ese SKU.", no se crea un duplicado, la página no se rompe.
4. Editar un producto existente y desmarcar el checkbox "Activo" → guardar → el badge de la lista pasa a "Inactivo" (gris).
5. Buscar por un fragmento del nombre y luego por un fragmento del SKU → en ambos casos filtra correctamente.
6. Filtrar por una categoría específica → solo aparecen productos de esa categoría.
7. Filtrar por estado "Inactivo" → solo aparecen los marcados inactivos.
8. Combinar búsqueda + categoría + estado a la vez → el resultado respeta los tres filtros combinados (AND).
9. Click en "Exportar CSV" → se descarga un CSV con columnas nombre/sku/categoria/unidad_medida/estado y los datos actuales.
10. Click en "Importar CSV", subir un CSV con algunos SKUs nuevos y alguno ya existente → toast informa cuántos se importaron y cuántos se omitieron; la lista se refresca con los nuevos.
11. Entrar al detalle de un producto y hacer click en "Eliminar producto", confirmar en el diálogo → el producto desaparece de la lista y redirige a `/productos`.
12. Ir a `/admin/auditoria`, filtrar por tabla "Productos" → aparecen las entradas de auditoría generadas por los pasos anteriores (creación, edición, eliminación), con el diff de campos expandible igual que clientes/leads/tickets.
13. Si hay forma de probar con un usuario sin permiso `productos.view`/`view_all` (por ejemplo, revisando temporalmente sus permisos en `/admin/permisos`): entrar a `/productos` redirige a `/403`.

Si algún paso falla, corregir antes de continuar al commit.

- [ ] **Step 5: Commit**

```bash
git add app/layouts/default.vue app/pages/admin/auditoria/index.vue
git commit -m "$(cat <<'EOF'
Conectar navegación y auditoría al módulo de productos

Ítem "Productos" en el sidebar (sección CRM) y opción "Productos" en
el filtro de tabla de /admin/auditoria, cerrando el flujo end-to-end
del catálogo.
EOF
)"
```
