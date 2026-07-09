# Eliminar clientes desde la UI

## Contexto

El backend para eliminar clientes ya existe y no se toca en este spec:

- Permiso `('clientes', 'delete')` ya sembrado en `permissions`
  (`20260702000600_seed_roles_permisos.sql`).
- Política RLS `clientes_delete` ya creada
  (`20260702000300_rls_policies.sql`), gateada por
  `has_permission(auth.uid(), 'clientes', 'delete')`.
- `deleteCliente(id)` ya existe en `app/composables/useClientes.ts`.

Lo que falta es exclusivamente la interfaz: hoy no hay ningún botón conectado
a esa función en toda la app.

**Restricción de datos importante:** ninguna FK hacia `clientes` tiene
`ON DELETE CASCADE` (`leads.cliente_id` y `tickets.cliente_id`, ver
`20260702000200_clientes_leads_tickets.sql`). Si el cliente tiene leads o
tickets asociados, Postgres rechaza el `delete` con una violación de foreign
key (`error.code === '23503'`). Este spec no cambia ese comportamiento — lo
usa como señal para explicarle al usuario por qué no se pudo borrar.

## Alcance

Agregar la opción de eliminar un cliente en dos lugares: el listado
(`/clientes`) y el detalle (`/clientes/[id]`), con confirmación explícita y
manejo de errores específico para el caso de registros asociados.

## Componente nuevo: `SharedConfirmDialog.vue`

Primer modal del proyecto — no existe ningún patrón previo de dialog. Vive en
`app/components/shared/`, mismo nivel que `Card.vue`/`Badge.vue`.

**Props:**
- `open: boolean`
- `titulo: string`
- `mensaje: string`
- `textoConfirmar?: string` (default `'Eliminar'`)
- `cargando?: boolean` (deshabilita el botón de confirmar mientras se espera
  la respuesta, evita doble click)

**Emits:** `confirmar`, `cancelar`

**Estilo:** overlay oscuro semitransparente + tarjeta centrada, mismos
tokens de color/espaciado que `SharedCard` (`rounded-2xl`, `border-gray-100`,
`shadow-sm`). Botón de confirmar en rojo (acción destructiva), botón de
cancelar neutro.

## Cambios en `ClienteTable.vue`

Se agrega un botón "Eliminar" (texto rojo, `text-red-600 hover:underline`)
junto al de "Editar"/"Ver" en la última columna, visible solo si
`can('clientes', 'delete')`. Al clickear, el componente **no borra nada
directamente** — emite `@eliminar="cliente"` (el objeto `Cliente` completo,
para que la página padre tenga `razon_social` a mano para el mensaje del
modal). El estado del modal y la llamada a `deleteCliente()` viven en la
página padre, no en la tabla (sigue el patrón actual donde `ClienteTable` es
un componente de presentación sin lógica de negocio).

## Cambios en `clientes/index.vue`

```ts
const clienteAEliminar = ref<Cliente | null>(null)
const eliminando = ref(false)

const onConfirmarEliminar = async () => {
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
```

`ClienteTable` recibe `@eliminar="clienteAEliminar = $event"`. Se agrega
`<SharedConfirmDialog>` al final del template, con
`:open="!!clienteAEliminar"`, `:titulo="'Eliminar cliente'"`,
`:mensaje="`¿Eliminar a ${clienteAEliminar?.razon_social}? Esta acción no se puede deshacer.`"`,
`:cargando="eliminando"`, `@confirmar="onConfirmarEliminar"`,
`@cancelar="clienteAEliminar = null"`.

## Cambios en `clientes/[id].vue`

Mismo patrón: botón "Eliminar cliente" (gateado por
`can('clientes', 'delete')`) debajo de `ClienteForm`, dentro de su propio
`SharedCard` o como acción suelta bajo el formulario existente. Mismo
`SharedConfirmDialog`, mismo manejo de error por `e.code === '23503'`. A
diferencia del listado, al confirmar exitosamente se redirige:

```ts
await deleteCliente(cliente.value.id)
success('Cliente eliminado')
await navigateTo('/clientes')
```

El toast sobrevive a la navegación porque su estado es global
(`useState('toasts', ...)`, montado una vez en el layout vía
`SharedToastContainer`).

## Manejo de errores (aplica a ambas páginas)

- `error.code === '23503'` (violación de foreign key) → mensaje específico
  mencionando leads/tickets asociados.
- Cualquier otro error → mensaje genérico existente en el resto de la app
  (`'No se pudo eliminar el cliente. Intenta de nuevo.'`).
- No hay conteo previo de leads/tickets antes de intentar el borrado —
  decisión explícita: se deja que la base rechace y se explica el motivo,
  sin round-trip adicional al servidor.
- Si falla, el modal se cierra igual (no se ofrece reintentar desde el mismo
  modal); el usuario debe volver a clickear "Eliminar" si quiere reintentar.

## Testing (manual, sin suite automatizada aún)

1. Como usuario con `clientes.delete`: crear un cliente sin leads/tickets
   asociados, eliminarlo desde `/clientes`. Confirmar toast de éxito y que
   desaparece de la lista sin recargar la página.
2. Repetir el mismo caso desde `/clientes/[id]`, confirmar que redirige a
   `/clientes` con el toast de éxito.
3. Intentar eliminar un cliente que sí tiene tickets asociados (cualquiera
   de los existentes con tickets). Confirmar el mensaje específico de "tiene
   leads/tickets asociados" y que el cliente sigue en la lista.
4. Como usuario SIN `clientes.delete` (ej. rol sin ese permiso): confirmar
   que el botón "Eliminar" no aparece ni en la tabla ni en el detalle.
5. Cancelar el modal sin confirmar: confirmar que no se llama a
   `deleteCliente` y el cliente sigue intacto.

## Fuera de alcance

- No se agrega borrado de leads ni tickets (aunque `SharedConfirmDialog`
  queda reutilizable para eso a futuro).
- No se cambia el comportamiento de las FK (sin cascada, sin `SET NULL`).
- No se agrega conteo/preview de registros asociados antes de intentar
  eliminar.
- No se agrega soft-delete (columna `deleted_at` o similar) — el borrado es
  definitivo, tal como ya está modelado en `deleteCliente()`.
