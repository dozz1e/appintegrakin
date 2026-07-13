# Pestaña "Ventas" en el detalle de cliente

## Contexto

El módulo `productos` (catálogo, `app/composables/useProductos.ts` +
`supabase/migrations/20260713000000_productos.sql` en adelante) recién
se agregó y hoy no está conectado a ninguna otra entidad — es catálogo
puro (nombre/SKU/categoría/unidad/estado, sin precio ni relación con
clientes). Se pide una primera conexión: una pestaña "Ventas" en el
detalle de cliente que muestre el historial de ventas (producto,
valor, fecha y hora) y permita registrar una nueva.

No existe ningún concepto de venta/compra/orden/factura en el sistema
todavía — se crea desde cero.

Estado actual relevante:

- **Dos vistas de detalle de cliente**: `app/pages/clientes/[id].vue`
  (página completa, sin tabs) y
  `app/components/clientes/ClienteSplitView.vue` (panel maestro-
  detalle usado en `app/pages/clientes/index.vue`, **con** tabs
  `'info' | 'tickets'` ya implementadas a mano — línea 16: `const
  tabActiva = ref<'info' | 'tickets'>('info')`, barra de tabs en
  líneas 126-144 con clase `border-b-2` + color `#1075B5` para la
  activa). La pestaña nueva va **solo acá** — `[id].vue` no se toca.
- `ClienteSplitView.vue` ya monta `SharedTareaList` en un panel lateral
  fijo de 320px (línea 207-209), fuera de las tabs — no se toca, la
  pestaña Ventas es contenido de tab, no un panel lateral nuevo.
- `useProductos.ts::fetchProductos()` trae el catálogo completo
  ordenado por `nombre`, sin filtro de `estado` — sirve tal cual para
  poblar el selector de producto (no se agrega filtro por "activo"
  en esta primera versión, ver Fuera de alcance).
- Patrón de alta rápida + lista de solo lectura ya resuelto en
  `app/components/shared/TareaList.vue`: inputs `date`+`time`
  separados que se combinan en un solo timestamp
  (`construirFechaVencimiento`, líneas 31-35), formulario arriba,
  lista abajo.
- Patrón RLS con `owner_id` (propio vs `view_all`) ya usado por
  `clientes`/`leads`/`tickets`, ejemplo exacto en
  `supabase/migrations/20260702000300_rls_policies.sql:47-63`
  (`tickets_select`/`tickets_insert`/`tickets_update`/`tickets_delete`).
- Patrón de catálogo compartido sin `owner_id` usado por `productos`
  (`20260713000100_productos_rls.sql`) — **no aplica acá**, se decidió
  que ventas sigue el patrón con `owner_id` como tickets.
- Ya existe un **rol** `ventas` ("Gestión de leads y clientes
  propios", seed en `20260702000600_seed_roles_permisos.sql:8`). El
  recurso de permisos nuevo también se llama `ventas` — se confirmó
  con el usuario que no hay conflicto real (`roles.name` y
  `permissions.resource` son columnas separadas), solo hay que leer
  con cuidado la matriz en `/admin/permisos`.
- Trigger de versión (`fn_incrementar_version`) y de auditoría
  (`registrar_auditoria`) ya existen como funciones reutilizables,
  usados tal cual por `productos` (`20260713000000_productos.sql:19-23`).

## Diseño

### Migración `supabase/migrations/20260713000300_ventas.sql`

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

`valor` es `numeric` sin escala fija (CLP no usa decimales en la
práctica, pero no se restringe a entero por si hay excepciones). No
hay `precio` de lista en `productos` para autocompletar — `valor` se
tipea a mano en cada venta (ver Fuera de alcance).

### RLS `supabase/migrations/20260713000400_ventas_rls.sql`

Mismo patrón exacto que `tickets` (`20260702000300_rls_policies.sql:47-63`),
sin política de `assign` (no aplica reasignar una venta):

```sql
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

`ventas_update`/`ventas_delete` quedan definidas por completitud del
patrón RBAC (todo recurso tiene los 5 permisos estándar), aunque la UI
de esta primera versión no expone editar/eliminar (ver Fuera de
alcance) — no se le da ese permiso a ningún rol en el seed.

### Permisos `supabase/migrations/20260713000500_ventas_permisos.sql`

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

Roles no listados (`marketing`, `servicio_tecnico`, `capacitaciones`)
quedan sin acceso a `ventas`, igual que hoy no tienen acceso a
`productos` salvo `dueña`.

### Composable `app/composables/useVentas.ts`

Mismo esqueleto que `useTareas.ts`, sin estado de polling (eso es
exclusivo del feature de recordatorios):

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

Orden por `fecha` descendente (venta más reciente primero) — a
diferencia de `TareaList.vue` que ordena por vencimiento ascendente
(próxima primero), acá lo relevante es el historial reciente.

### Componente `app/components/clientes/VentaList.vue`

Mismo patrón que `TareaList.vue` (formulario arriba + lista de solo
lectura abajo, sin edición/borrado):

Props: `clienteId: string`.

Comportamiento:
- Al montar: `fetchVentasPorCliente(clienteId)` y, en paralelo,
  `fetchProductos()` (de `useProductos.ts`) para poblar el `<select>`
  de producto.
- Formulario: `<select>` de producto (texto = `nombre`, value = `id`),
  input `number` para valor, input `date` + input `time` (mismo
  patrón que `TareaList.vue`, pero acá la hora es obligatoria — a
  diferencia de una tarea, una venta siempre tiene fecha/hora
  concretas, no hay default "fin del día"). Botón "Registrar venta".
- Al enviar: valida que haya producto seleccionado, valor > 0, y
  fecha+hora completas; combina fecha+hora a ISO con el mismo cálculo
  de `construirFechaVencimiento` pero sin el default 23:59 (acá hora
  vacía es error de validación, no un valor por omitir).
- Lista: cada fila muestra nombre del producto (resuelto por
  `producto_id` contra la lista ya cargada de `fetchProductos()`,
  mismo enfoque que `ClienteSplitView.vue` resuelve `t.estado` con un
  helper local, no un join en la consulta), valor formateado
  `Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })`,
  y fecha/hora con `toLocaleString('es-CL', { day: '2-digit', month:
  'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })`
  (mismo formato ya usado en `NotificationBell.vue`/`TicketBoard.vue`
  para fecha, agregándole hora).
- Sin edición ni borrado (confirmado con el usuario) — si hace falta
  corregir una venta cargada mal, se hace directo en la base de datos
  por ahora, caso excepcional que no justifica UI de edición en esta
  primera versión.

### `ClienteSplitView.vue`

- `tabActiva` pasa de `ref<'info' | 'tickets'>('info')` a
  `ref<'info' | 'tickets' | 'ventas'>('info')`.
- Se agrega `puedeVerVentas = computed(() => can('ventas', 'view') ||
  can('ventas', 'view_all'))`, mismo patrón que `puedeVerTickets`.
- Nuevo botón de tab "Ventas" junto a "Tickets" (visible solo si
  `puedeVerVentas`), misma clase condicional
  `border-[#1075B5] text-[#1075B5]` / `border-transparent text-gray-400`.
- Nuevo bloque `<div v-else-if="tabActiva === 'ventas'">` (la
  estructura si/else actual de "info" vs "tickets" pasa a
  if/else-if/else de tres ramas) que monta
  `<ClientesVentaList :cliente-id="seleccionado.id" />`.
- El watcher de `seleccionadoId` (línea 36-42) sigue reseteando
  `tabActiva.value = 'info'` al cambiar de cliente — no hace falta
  tocarlo, ya cubre la pestaña nueva porque vuelve siempre a `'info'`.

## Fuera de alcance

- No se toca `app/pages/clientes/[id].vue` (página completa sin tabs).
- No se agrega `precio` a `productos` — `valor` de cada venta se tipea
  a mano, sin autocompletar desde un precio de lista.
- No hay stock/inventario — registrar una venta no descuenta nada de
  `productos`.
- Sin edición ni borrado de ventas ya registradas desde la UI (los
  permisos `edit`/`delete` quedan definidos en la RLS por
  completitud del patrón, pero sin uso ni seed en esta versión).
- Sin filtro de `productos` por `estado = 'activo'` en el selector —
  se listan todos, igual que hoy `fetchProductos()` no filtra.
- No se agrega a esta migración ninguna vista/reporte agregado de
  ventas totales por cliente o por vendedor — la pestaña solo lista
  el historial crudo.

## Testing (manual, sin suite automatizada)

1. Con un usuario con permiso `ventas.create`, entrar a `/clientes`,
   seleccionar un cliente: aparece la pestaña "Ventas" junto a
   "Información" y "Tickets".
2. Click en "Ventas": muestra el formulario de alta (selector de
   producto con el catálogo completo, valor, fecha, hora) y, debajo,
   el historial (vacío si no hay ventas todavía).
3. Completar el formulario y registrar: la venta aparece de inmediato
   en el historial, arriba de todo (orden por fecha descendente),
   producto y valor formateados correctamente.
4. Registrar una segunda venta con fecha anterior a la primera: queda
   ordenada después (más antigua abajo).
5. Intentar registrar sin seleccionar producto, o con valor vacío/0,
   o sin fecha/hora: no se envía, se ve un error de validación.
6. Cambiar de cliente en la lista de la izquierda: la pestaña vuelve a
   "Información" y el historial de ventas se recarga para el nuevo
   cliente seleccionado.
7. Con un usuario sin permiso `ventas.view` ni `ventas.view_all`: no
   aparece la pestaña "Ventas".
8. Con un usuario con `ventas.view` (no `view_all`) y `owner_id`
   propio: solo ve las ventas que él mismo registró para ese cliente,
   no las de otros vendedores (verificar con dos usuarios de prueba
   si el entorno lo permite; si no, documentar como pendiente de
   verificación manual del usuario).
