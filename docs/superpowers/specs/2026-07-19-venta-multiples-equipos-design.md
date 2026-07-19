# Nueva venta: múltiples equipos y cantidad — Design Spec

**Fecha:** 2026-07-19

## Contexto

El modal "Registrar venta" (`app/components/clientes/VentaList.vue`) solo permite
cargar un producto por venta: un `ProductoBuscador`, fecha, hora. La tabla
`ventas` (`app/composables/useVentas.ts`) tiene una fila por producto, sin
columna de cantidad — no hay forma de registrar "3 routers modelo X" en una
sola venta, solo se puede crear una fila a la vez.

Pedido: en el modal de nueva venta, poder agregar varios equipos (productos)
y la cantidad de cada uno, arrancando con una línea por defecto.

## Alcance

- Modal de creación de venta (`VentaList.vue`): pasa de un solo producto a una
  lista de líneas `{ producto, cantidad }`.
- Edición de una venta existente: se mantiene fila por fila (sin volverse
  multi-línea), pero gana un input de cantidad.
- Fuera de alcance: cualquier otro punto de creación de ventas — no existe
  otro (`crearVenta` solo se usa desde `VentaList.vue`, confirmado por grep).

## Modelo de datos

Migración agrega columna `cantidad` a `ventas`:

```sql
alter table public.ventas
  add column cantidad integer not null default 1;

alter table public.ventas
  add constraint ventas_cantidad_check check (cantidad > 0);
```

Cada línea de equipo sigue siendo una fila propia en `ventas` — la relación
"1 producto = 1 fila" no cambia, la fila ahora además guarda cuántas unidades
de ese producto representa.

## Composable (`useVentas.ts`)

- `Venta` interface gana `cantidad: number`.
- Nueva función `crearVentas` reemplaza el uso directo de `crearVenta` desde
  el modal de creación:

```ts
interface LineaVenta {
  productoId: string
  cantidad: number
}

async function crearVentas(
  clienteId: string,
  lineas: LineaVenta[],
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

Un solo `insert` con array de filas — Postgres lo ejecuta como una sola
sentencia (todo o nada), sin necesitar transacción explícita ni RPC nuevo.
`crearVenta` (singular) queda sin uso una vez migrado el modal — se elimina
del composable. `actualizarVenta` no cambia de firma, solo gana `cantidad`
como campo editable dentro de su `Partial<Venta>` ya existente.

## UI — modal "Registrar venta"

Estado pasa de `productoId/fecha/hora` sueltos a:

```ts
const lineas = ref([{ productoId: '', cantidad: 1 }])
const fecha = ref('')
const hora = ref('')
```

Por cada línea: `ProductoBuscador` + input numérico de cantidad
(`min="1"`, default `1`) + botón "✕" para quitar la línea (oculto/deshabilitado
si es la única línea restante — no se puede llegar a 0 líneas). Botón
"+ Agregar equipo" al final de la lista agrega `{ productoId: '', cantidad: 1 }`.

Fecha y hora quedan compartidas para todas las líneas del envío (una venta,
varios equipos, mismo momento).

Validación: cada línea requiere `productoId` no vacío; `cantidad >= 1`
(el input numérico ya restringe, pero se valida también en `onSubmit`).
Fecha/hora siguen siendo obligatorias como hoy.

`onSubmit` llama `crearVentas(clienteId, lineas, fecha)`, resetea el form a
una línea default, cierra el modal, recarga.

## UI — edición de fila existente

Se agrega input de cantidad junto a producto/fecha/hora/valor en el bloque de
edición inline (mismo layout `flex flex-wrap gap-2` que ya existe). Sigue
editando una sola fila — no se convierte en editor multi-línea. Guarda con
`actualizarVenta(id, { ...otros, cantidad }, version)`.

## Errores y edge cases

- Falla el batch insert completo → mismo patrón de error ya usado
  (`error('No se pudo registrar la venta')`), ninguna línea queda a medias
  porque es una sola sentencia SQL.
- Quitar todas las líneas: no permitido, el botón "✕" no se muestra en la
  última línea restante.
- Cantidad no numérica o ≤ 0: bloqueado por `type="number" min="1"` del input
  más validación en `onSubmit`.

## Testing

- Build (`npm run build`) y verificación manual en navegador (usuario): crear
  venta con 1 línea (comportamiento actual sin cambios), crear venta con 2+
  líneas y cantidades distintas, editar una venta existente y cambiar su
  cantidad, intentar quitar la última línea (botón no debe aparecer).
