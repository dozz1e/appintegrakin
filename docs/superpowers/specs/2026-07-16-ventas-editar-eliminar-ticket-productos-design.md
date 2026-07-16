# Editar/eliminar ventas + productos comprados en tickets

## Contexto

Dos pedidos relacionados con `productos`/`ventas`:

1. `VentaList.vue` (tab Ventas de `ClienteSplitView.vue`) hoy solo
   permite crear ventas — sin editar ni eliminar. Además el form nunca
   pidió el campo `valor`: `onSubmit` llama `crearVenta(clienteId,
   productoId, 0, fecha)` con el valor hardcodeado en `0`
   (`VentaList.vue:100`), aunque la tabla `ventas.valor` es `not null`
   y el composable ya acepta el parámetro. RLS y permisos de
   `update`/`delete` ya existen desde
   `20260713000400_ventas_rls.sql`/`20260713000500_ventas_permisos.sql`
   (dueña: view_all+create+edit+delete; roles `ventas`/`post_venta`:
   view+create+edit, sin delete) — no hace falta tocar la base para
   esta parte.

2. El módulo de tickets de **servicio técnico** (`tickets`,
   distinto de `tickets_post_venta`) no tiene ninguna relación con
   `productos`. El módulo de **post-venta** sí — su
   `TicketForm.vue` ya muestra chips de "comprado por este cliente"
   (via `fetchVentasPorCliente` + `fetchProductosPorIds`) pero de
   selección única (`form.producto_id: string`), porque un ticket de
   post-venta es sobre un solo equipo. Servicio técnico necesita lo
   mismo pero permitiendo varios productos por ticket, así que hace
   falta una tabla de relación nueva (no hay columna existente que
   reusar).

## Parte A — Ventas: editar, eliminar y campo valor

### Composable `useVentas.ts`

Agregar, mismo patrón optimistic locking que `useTickets.ts`/
`useProductos.ts`:

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
  if (expectedVersion !== undefined && !data) throw new Error('CONFLICTO_VERSION')
  return data as Venta
}

async function eliminarVenta(id: string): Promise<void> {
  const { data, error } = await supabase.from('ventas').delete().eq('id', id).select()
  if (error) throw error
  if (!data?.length) throw new Error('No se pudo eliminar la venta')
}
```

`eliminarVenta` chequea filas afectadas porque `.delete()` no tira
error cuando RLS bloquea la operación silenciosamente (gotcha #18 de
`CONTEXTO_PROYECTO.md`).

### `VentaList.vue`

- Input `valor` (`type="number"`, `min="0"`, requerido) en el form de
  creación; se pasa el valor real a `crearVenta` en vez del `0`
  hardcodeado.
- Cada fila de venta muestra el valor formateado en CLP
  (`Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })`).
- Editar/eliminar por fila, mismo patrón inline que
  `TareaList.vue` (`onEditar`/`onCancelarEdicion`/`onGuardarEdicion`,
  fila se reemplaza por un form con Guardar/Cancelar; eliminar con
  `SharedConfirmDialog`).
- Botones gateados por `can('ventas', 'edit')` / `can('ventas',
  'delete')` (`usePermissions()`), para que roles `ventas`/`post_venta`
  vean editar pero no eliminar.
- Simplificación en el mismo cambio: se reemplaza el dropdown de
  búsqueda de producto hecho a mano (~40 líneas: `busquedaProducto`,
  `buscadorAbierto`, `contenedorBuscador`, `elegirProducto`,
  `onClickFueraBuscador`, `productosFiltrados`, el `watch` de
  desincronización) por el componente compartido
  `ProductosProductoBuscador` (ya usado en
  `post-venta/TicketForm.vue`) — se necesita de todos modos un
  segundo picker para la fila de edición, así se evita duplicar la
  lógica una tercera vez. `productos.value` (fetch de
  `fetchProductos()`) se mantiene solo para resolver `nombreProducto()`
  en el listado de solo lectura.

## Parte B — Productos comprados en tickets (servicio técnico)

### Migración `20260716060000_ticket_productos.sql`

```sql
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

Mismo patrón de RLS en cascada que `entidad_imagenes`
(`20260716020000_entidad_imagenes.sql`): la condición reusa las mismas
reglas de `tickets_select`/`tickets_update`
(`20260702000300_rls_policies.sql:47-63`) contra la fila padre. Sin
trigger de auditoría (igual criterio que `entidad_imagenes`, no es una
entidad de negocio en sí misma). `on delete cascade` en `ticket_id`
para que borrar un ticket no deje filas huérfanas.

### Composable nuevo `useTicketProductos.ts`

```ts
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

  async function agregarProductoATicket(ticketId: string, productoId: string) {
    const { error } = await supabase
      .from('ticket_productos')
      .insert({ ticket_id: ticketId, producto_id: productoId, created_by: user.value?.sub })
    if (error) throw error
  }

  async function quitarProductoDeTicket(ticketId: string, productoId: string) {
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

### `TicketForm.vue` (tickets, no toca post-venta)

- Nuevo prop `productosAsociados?: string[]` (ids ya vinculados, solo
  relevante en modo edición) — inicializa `productosSeleccionados =
  ref<string[]>([...(props.productosAsociados ?? [])])`.
- `watch(() => form.cliente_id, ..., { immediate: true })`: igual
  patrón que `post-venta/TicketForm.vue` — con `fetchVentasPorCliente`
  + dedup de `producto_id` + `fetchProductosPorIds` arma `comprados`.
  `immediate: true` porque acá el cliente puede venir prefijado
  (`clienteIdFijo`) y el watch normal no dispara con el valor inicial.
- Chips de `comprados`, pero a diferencia de post-venta son
  multi-toggle (push/splice sobre `productosSeleccionados` en vez de
  asignación directa) — chip activo si `productosSeleccionados.includes(p.id)`.
- `emit('submit', payload, archivo, productosSeleccionados)` — tercer
  parámetro nuevo en la firma del emit, separado del `Partial<Ticket>`
  porque no es una columna de `tickets`.

### `tickets/nuevo.vue`

Tras `createTicket(payload)`, si `productosIds.length`:
```ts
await Promise.all(productosIds.map((id) => agregarProductoATicket(ticket.id, id)))
```
Mismo bloque try/catch aislado que ya usa la subida de imagen (no
bloquea la creación del ticket si falla).

### `tickets/[id].vue`

- `onMounted`: además de `getTicket`, llama
  `fetchProductosDeTicket(id)` y guarda los ids en
  `productosAsociadosIds = ref<string[]>([])`; los pasa a
  `<TicketsTicketForm :productos-asociados="productosAsociadosIds">`.
- `onSubmit(payload, _archivo, productosIds)`: calcula diff contra
  `productosAsociadosIds.value` —
  `agregados = productosIds.filter(id => !productosAsociadosIds.value.includes(id))`,
  `quitados = productosAsociadosIds.value.filter(id => !productosIds.includes(id))`
  — llama `agregarProductoATicket`/`quitarProductoDeTicket` para cada
  uno, luego actualiza `productosAsociadosIds.value = productosIds`.

## Fuera de alcance

- No se toca `post-venta/TicketForm.vue` ni `tickets_post_venta`
  (selección única, ya funciona, no pedido).
- No se agrega `valor` a la vista de detalle de ticket ni a ningún
  reporte — solo la asociación producto↔ticket.
- No se permite adjuntar productos que el cliente no compró (el
  picker solo ofrece los `comprados`, no hay buscador libre de
  catálogo completo en este form).
- No se migra el buscador de producto de `post-venta/TicketForm.vue`
  a componente compartido en este cambio (ya usa
  `ProductosProductoBuscador` — nada que tocar ahí).

## Testing (manual, sin suite automatizada)

**Ventas:**
1. Crear una venta con valor > 0 → aparece en el listado con el monto
   formateado en CLP.
2. Editar una venta (producto/fecha/hora/valor) con rol `ventas` o
   `post_venta` → guarda, no ve botón eliminar.
3. Eliminar una venta con rol `dueña` → desaparece del listado.
4. Editar una venta que otra persona modificó mientras tanto (dos
   pestañas) → error de conflicto de versión, igual que
   clientes/leads/tickets.

**Tickets — productos:**
1. Crear un ticket con un cliente que tiene ventas registradas → se
   ven chips de productos comprados, elegir 2 → quedan asociados tras
   crear.
2. Crear un ticket con un cliente sin ventas → no aparecen chips, el
   ticket se crea igual sin productos asociados.
3. Abrir un ticket existente con productos asociados → chips
   correspondientes aparecen pre-seleccionados.
4. En edición, deseleccionar un producto y seleccionar otro nuevo →
   al guardar, el listado de asociados refleja el cambio (no quedan
   ambos ni ninguno).
5. Ticket creado desde `/clientes/[id]` (cliente prefijado,
   `clienteIdFijo`) → los chips de comprados igual aparecen sin
   necesidad de tocar el buscador de cliente.
