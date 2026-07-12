# Catálogo de Productos

## Contexto

Primer módulo nuevo del CRM desde clientes/leads/tickets. El usuario
tiene un Excel con ~productos (nombre, SKU, categoría, unidad de
medida, estado activo/inactivo) que quiere cargar como catálogo. A
diferencia de clientes/leads/tickets, un producto no es "propiedad" de
un vendedor — es un catálogo compartido, así que no lleva `owner_id`
ni distinción propio/todos en la visibilidad.

Decisiones de producto (validadas con el usuario):

1. **Solo catálogo independiente** — sin relación con clientes/leads/
   tickets en esta primera versión (no se puede "elegir productos"
   dentro de un ticket o lead todavía).
2. **SKU único** — constraint `unique` en la base de datos, mismo
   patrón que `clientes.rut`.
3. **Categoría y unidad de medida como texto libre** — se guardan tal
   cual vienen del Excel, sin catálogo fijo de valores. Se puede
   convertir a lista fija más adelante si hace falta.
4. **Vista de lista: tabla con búsqueda y filtros**, no panel dividido
   (que usa clientes) ni tablero por estado (que usan leads/tickets) —
   un catálogo de potencialmente cientos de SKUs se navega mejor como
   tabla filtrable. Alta y edición en páginas separadas
   (`/productos/nuevo`, `/productos/[id]`), mismo patrón que clientes.
5. **Import/Export CSV**, mismo patrón que clientes/leads (dedup por
   SKU en vez de RUT/nombre). Se usa para la carga inicial del Excel
   del usuario (convertido a CSV, mismo proceso ya usado para importar
   los 1893 clientes).
6. **Permisos**: nuevos `productos.view`, `productos.view_all`,
   `productos.create`, `productos.edit`, `productos.delete`. Por
   defecto solo se le dan al rol `dueña` (acceso total) — el resto de
   roles queda sin acceso hasta que el usuario los active manualmente
   desde `/admin/permisos` (pantalla ya existente, no hace falta
   adivinar qué rol necesita ver productos).

Extensiones naturales de infraestructura ya existente, incluidas por
consistencia (no fueron pedidas explícitamente, se marcan acá para que
el usuario las revise):

- **Auditoría**: se engancha el trigger `registrar_auditoria()` ya
  existente (`supabase/migrations/20260702000800_audit_log.sql`) a la
  tabla `productos`, igual que clientes/leads/tickets. Como
  consecuencia, se agrega `<option value="productos">Productos</option>`
  al selector de tabla fijo en `app/pages/admin/auditoria/index.vue`.
- **Optimistic locking**: se agrega la columna `version` + el trigger
  `fn_incrementar_version()` ya existente
  (`supabase/migrations/20260707010000_optimistic_locking.sql`), mismo
  patrón que clientes/leads/tickets, para que `updateProducto` pueda
  detectar ediciones concurrentes igual que el resto del CRM.

## Diseño

### Migración: tabla `productos`

```sql
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

### RLS

Mismo patrón que clientes/leads/tickets, sin la parte de `owner_id`
(no aplica: catálogo compartido, no hay "lo propio"):

```sql
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

### Permisos seed

Nueva migración (no se toca `20260702000600_seed_roles_permisos.sql`,
que ya corrió en producción):

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

### `app/composables/useProductos.ts`

Mismo patrón que `useClientes.ts`, sin `owner_id`/`nombre_contacto`/
imagen:

```ts
// composables/useProductos.ts

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
  // patrón que importClientes. Filas sin sku o sin nombre se descartan.
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

### `app/pages/productos/index.vue`

Tabla con búsqueda (nombre/SKU) y filtros por categoría/estado,
100% client-side (el catálogo completo se trae de una vez, igual que
clientes hoy — no hay paginación server-side en esta primera versión,
igual que el resto del CRM salvo auditoría):

```ts
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
```

Template: header estándar (`SharedPageHeader`) con botones Exportar
CSV / Importar CSV / "+ Nuevo producto" (mismo layout que
`clientes/index.vue`); debajo, fila de buscador + selects de
categoría/estado (mismo estilo Tailwind que los filtros de auditoría);
debajo, tabla con columnas Nombre, SKU, Categoría, Unidad, Estado
(badge activo=verde/inactivo=gris), fila clickeable que navega a
`/productos/[id]`.

### `app/pages/productos/nuevo.vue` y `app/pages/productos/[id].vue`

Mismo patrón que `clientes/nuevo.vue` y `clientes/[id].vue`
(`SharedPageHeader` + `SharedCard` + formulario), sin el manejo de
imagen. El componente `ProductosProductoForm.vue`:

- Campos: Nombre* (text), SKU* (text), Categoría (text), Unidad de
  medida (text).
- Estado: en `nuevo.vue` no se muestra (siempre nace `activo`, default
  de la base). En `[id].vue` se edita con un toggle activo/inactivo
  (no un select), reutilizando el patrón visual de badges ya usado en
  auditoría/tickets para el color.
- Validación: nombre y SKU obligatorios (mismo estilo de
  `errores.razon_social` en `ClienteForm.vue`).
- Botón "Eliminar producto" en `[id].vue` solo si `can('productos',
  'delete')`, con `SharedConfirmDialog`, igual que clientes.

### Navegación

`app/layouts/default.vue`, agregar a `navCrm`:

```ts
{ path: '/productos', label: 'Productos', permiso: ['view', 'view_all'] as const, resource: 'productos' },
```

## Fuera de alcance

- Sin relación con clientes/leads/tickets (no se puede asociar
  productos a un ticket o lead todavía).
- Sin lista fija de categorías ni unidades de medida — texto libre.
- Sin paginación server-side en la tabla (se trae el catálogo completo
  de una vez, igual que clientes hoy).
- Sin control de stock/inventario — el catálogo es solo nombre/SKU/
  categoría/unidad/estado, no cantidades ni precios.
- No se toca `useCsv.ts` (genérico, ya sirve tal cual).

## Testing (manual, sin suite automatizada)

1. Crear un producto con nombre y SKU → aparece en la lista, estado
   `activo` por defecto.
2. Crear un producto con SKU repetido → error de constraint único,
   mensaje de error visible (no rompe la página).
3. Editar un producto y cambiar el toggle a `inactivo` → se refleja en
   la lista y en el badge.
4. Buscar por nombre parcial y por SKU parcial → filtra correctamente.
5. Filtrar por categoría → solo productos de esa categoría.
6. Filtrar por estado → solo activos o solo inactivos según selección.
7. Combinar búsqueda + categoría + estado → resultado respeta los tres
   filtros (AND).
8. Exportar CSV → contiene las 5 columnas con los datos actuales.
9. Importar un CSV con SKUs nuevos y algunos ya existentes → solo se
   insertan los nuevos, se informa cuántos se omitieron.
10. Eliminar un producto (con permiso) → desaparece de la lista.
11. Usuario sin permiso `productos.view`/`view_all` → redirige a
    `/403` al entrar a `/productos`.
12. Confirmar en `/admin/auditoria` que crear/editar/eliminar un
    producto genera una entrada de auditoría filtrable por tabla
    "Productos".
