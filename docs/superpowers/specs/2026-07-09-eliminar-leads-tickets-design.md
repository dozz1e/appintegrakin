# Eliminar leads y tickets desde la UI

## Contexto

Continuación de "Eliminar clientes desde la UI"
([[2026-07-09-eliminar-clientes-design]]). El mismo pedido, aplicado a las
otras dos entidades núcleo: leads y tickets.

El permiso (`leads.delete` / `tickets.delete`) y las políticas RLS
(`leads_delete`, `tickets_delete`) ya existen desde
`20260702000600_seed_roles_permisos.sql` y `20260702000300_rls_policies.sql`.
A diferencia de clientes, ni `useLeads.ts` ni `useTickets.ts` tienen todavía
una función de borrado — hay que agregarlas.

## Diferencias clave respecto al spec de clientes

1. **Sin tabla de listado.** Leads y tickets se muestran en Kanban
   (`LeadKanban.vue`, `TicketBoard.vue`), con tarjetas arrastrables. Agregar
   un botón de eliminar directo en la tarjeta arrastrable arriesga conflicto
   con el drag & drop y no fue lo elegido — la opción de eliminar vive
   **solo en el detalle** (`/leads/[id]`, `/tickets/[id]`), reutilizando el
   componente `SharedConfirmDialog` ya existente.

2. **Sin bloqueo por foreign key.** A diferencia de `clientes` (bloqueado
   por `tickets.cliente_id not null references clientes(id)` sin cascada),
   ninguna FK real bloquea el borrado de un lead o un ticket:
   - `lead_interacciones.lead_id references leads(id) on delete cascade`
     (`20260705000100_lead_interacciones.sql:8`) — se borran solas.
   - `tareas` y `notificaciones` referencian leads/tickets por
     `entidad_tipo`/`entidad_id` (columnas de texto + uuid, **sin FK real**),
     así que Postgres no impide el borrado por esa vía.

3. **Decisión explícita: tareas y notificaciones quedan huérfanas.** No se
   agrega limpieza de `tareas`/`notificaciones` al borrar un lead/ticket.
   Hoy esto no rompe nada visible: `fetchTareasPorEntidad` solo se llama
   con el `id` de la entidad que está montada (si se borró, esa página ya
   no se visita), y `fetchMisTareasPendientes` (que sí trae tareas de
   cualquier entidad) no se consume todavía en ningún componente. Es dato
   sucio aceptado a cambio de no agregar dos deletes extra por flujo ni
   arriesgar borrar notificaciones que otro usuario ya leyó/archivó.

## Composables

### `app/composables/useLeads.ts`

Agregar, siguiendo el patrón exacto de `deleteCliente`:

```ts
const deleteLead = async (id: string) => {
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) throw error
}
```

Y agregarla al `return` del composable.

### `app/composables/useTickets.ts`

```ts
const deleteTicket = async (id: string) => {
  const { error } = await supabase.from('tickets').delete().eq('id', id)
  if (error) throw error
}
```

Y agregarla al `return` del composable.

## `app/pages/leads/[id].vue`

Se agrega, gateada por `can('leads', 'delete')`, una tarjeta "Eliminar lead"
con el mismo estilo que la de clientes (`bg-red-600` botón, `SharedCard`,
separada por `mt-6` de las secciones existentes — formulario, conversión a
cliente, tareas, timeline). Reutiliza `SharedConfirmDialog`.

```ts
const confirmandoEliminar = ref(false)
const eliminando = ref(false)

async function onConfirmarEliminar() {
  if (!lead.value) return
  eliminando.value = true
  try {
    await deleteLead(lead.value.id)
    success('Lead eliminado')
    await router.push('/leads')
  } catch (e) {
    error('No se pudo eliminar el lead. Intenta de nuevo.')
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}
```

(El archivo ya usa `router.push` para la navegación de "convertir a
cliente" — se reutiliza `router`, no `navigateTo`, por consistencia con el
resto del archivo.)

Mensaje del diálogo: `` `¿Eliminar a ${lead.nombre}? Esta acción no se puede deshacer.` ``

## `app/pages/tickets/[id].vue`

Mismo patrón, gateada por `can('tickets', 'delete')`, redirige a `/tickets`.
Este archivo no usa `router` en ningún otro lado — se usa `navigateTo`
(como en clientes), por ser el estilo por defecto de Nuxt y no haber
precedente local que dicte lo contrario.

```ts
const confirmandoEliminar = ref(false)
const eliminando = ref(false)

async function onConfirmarEliminar() {
  if (!ticket.value) return
  eliminando.value = true
  try {
    await deleteTicket(ticket.value.id)
    success('Ticket eliminado')
    await navigateTo('/tickets')
  } catch (e) {
    error('No se pudo eliminar el ticket. Intenta de nuevo.')
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}
```

Mensaje del diálogo: `` `¿Eliminar "${ticket.titulo}"? Esta acción no se puede deshacer.` ``

## Manejo de errores

Sin caso especial de FK (a diferencia de clientes): cualquier error en el
`catch` muestra el mensaje genérico correspondiente
("No se pudo eliminar el lead/ticket. Intenta de nuevo."). No se distingue
`e.code` porque no hay ninguna restricción de la base que se espere que
falle en este flujo.

## Testing (manual, sin suite automatizada aún)

1. Como usuario con `leads.delete`: eliminar un lead de prueba desde su
   detalle. Confirmar el toast "Lead eliminado" y que redirige a `/leads`
   con el Kanban actualizado (sin el lead borrado).
2. Repetir el mismo caso para un ticket con `tickets.delete`, confirmar
   redirect a `/tickets`.
3. Como usuario sin `leads.delete` / `tickets.delete`: confirmar que la
   tarjeta "Eliminar" no aparece en ninguno de los dos detalles.
4. Cancelar el modal en ambos casos: confirmar que no se llama a
   `deleteLead`/`deleteTicket` y la entidad sigue intacta.
5. Eliminar un lead que tiene interacciones registradas (timeline) y
   confirmar que el borrado funciona sin error (la cascada de
   `lead_interacciones` no debería bloquear nada).

## Fuera de alcance

- No se agrega borrado desde las tarjetas del Kanban (`LeadKanban.vue`,
  `TicketBoard.vue`) — solo desde el detalle.
- No se limpian `tareas` ni `notificaciones` huérfanas al borrar un
  lead/ticket (decisión explícita, ver arriba).
- No se cambia el comportamiento de ninguna FK ni se agrega cascada nueva.
- No se agrega soft-delete.
- No se toca `useClientes.ts` ni el flujo de eliminar clientes ya
  implementado.
