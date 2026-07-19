# Dashboard personal editable (reordenar y ocultar cards)

## Contexto

Hoy el dashboard personal (`app/pages/index.vue`) muestra los widgets
que el usuario tiene asignados en `user_dashboard_widgets`
(`orden`, `config`), leídos vía RPC `mis_widgets()`. La única forma de
agregar/quitar/reordenar widgets es el panel `/admin/dashboards`, que
exige el permiso `dashboard_widgets.assign` (dueña o superadmin) — la
policy de escritura de `user_dashboard_widgets` es `ALL` gateada por
ese permiso, sin excepción para la fila propia:

```sql
-- estado actual
user_dashboard_widgets_select: (user_id = auth.uid()) OR has_permission(..., 'view_all') OR has_permission(..., 'assign')
user_dashboard_widgets_write:  ALL — has_permission(auth.uid(), 'dashboard_widgets', 'assign')
```

Se pide que **cualquier usuario** pueda reposicionar y ocultar sus
propias cards, sin depender de ese permiso. Agregar widgets nuevos al
propio dashboard sigue siendo tarea del admin (fuera de alcance).

El proyecto ya usa `vuedraggable` (`LeadKanban.vue`, `TicketBoard.vue`,
`post-venta/TicketBoard.vue`) — se reutiliza la misma librería, sin
dependencias nuevas.

## Diseño

### Base de datos

```sql
-- supabase/migrations/20260719000000_dashboard_widgets_self_service.sql
alter table user_dashboard_widgets
  add column visible boolean not null default true;

create policy user_dashboard_widgets_self_update
  on user_dashboard_widgets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

La policy nueva es permisiva y se suma (OR) a la `ALL` existente de
admin — no la reemplaza. Solo cubre `UPDATE`; insertar/borrar filas
sigue exigiendo `dashboard_widgets.assign` (eso es "agregar/quitar
definitivamente", tarea del admin). "Ocultar" desde el propio usuario
es un `UPDATE` de `visible`, no un `DELETE`.

`mis_widgets()` se actualiza: agrega `widget_id` (falta hoy, se
necesita para poder hacer el `UPDATE` desde el cliente) y **ya no
filtra por visible** — trae todo lo asignado, visible u oculto. El
filtro para qué se renderiza en el grid vs. la franja de ocultos lo
hace el frontend.

```sql
CREATE OR REPLACE FUNCTION public.mis_widgets()
 RETURNS TABLE(widget_id uuid, key text, label text, component text, resource text, tipo text, orden integer, config jsonb, visible boolean)
 LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  select w.id, w.key, w.label, w.component, w.resource, w.tipo, udw.orden, udw.config, udw.visible
  from user_dashboard_widgets udw
  join dashboard_widgets w on w.id = udw.widget_id
  where udw.user_id = auth.uid()
  order by udw.orden;
$function$
```

### `useDashboardWidgets.ts`

`MiWidget` gana `widgetId: string` y `visible: boolean`. Dos funciones
nuevas, self-service (sin chequeo de permiso — la RLS ya lo garantiza
por fila propia):

```ts
const reordenarMisWidgets = async (items: { widgetId: string; orden: number }[]) => {
  await Promise.all(
    items.map(({ widgetId, orden }) =>
      supabase.from('user_dashboard_widgets').update({ orden }).eq('widget_id', widgetId).eq('user_id', uid)
    )
  )
}

const setVisibilidadMiWidget = async (widgetId: string, visible: boolean) => {
  const { error } = await supabase
    .from('user_dashboard_widgets')
    .update({ visible })
    .eq('widget_id', widgetId)
    .eq('user_id', uid)
  if (error) throw error
}
```

(`uid` sale de `useSupabaseUser()`, ya disponible en el composable.)

### `app/pages/index.vue`

- Botón "Editar dashboard" arriba a la derecha (toggle `modoEdicion`,
  solo visual — no requiere permiso).
- `kpisVisibles`/`chartsVisibles` pasan a filtrar además por
  `visible === true`. Se agregan `kpisOcultos`/`chartsOcultos`
  (`visible === false`) para la franja de reactivación.
- En modo edición, cada grid se envuelve en `<draggable v-model="...">`
  (mismo patrón que `LeadKanban.vue`). Arrastre **solo dentro de su
  sección** — KPIs no se mezclan con charts, son dos listas
  `draggable` independientes.
- Cada card en modo edición muestra una "X" arriba a la derecha
  (overlay) que llama `setVisibilidadMiWidget(w.widgetId, false)` y
  saca el widget del array local al toque (optimista).
- `@end` del draggable: recalcula `orden` secuencial (0,1,2...) del
  array completo de esa sección y llama `reordenarMisWidgets`. Si
  falla, revertir el array local al orden previo (guardado antes del
  drag) + toast de error.
- Franja inline al final, solo en modo edición, solo si hay
  `kpisOcultos.length || chartsOcultos.length`: cards atenuadas
  (`opacity-50`, sin datos reales — solo ícono + label, no se monta el
  componente real) con botón "+" que llama
  `setVisibilidadMiWidget(w.widgetId, true)` y la mueve de vuelta al
  array visible correspondiente (optimista).
- Fuera de modo edición: comportamiento actual, sin cambios (grids
  ordenados por `orden`, solo visibles).

### `/admin/dashboards` (panel admin)

Sin cambios. Sigue siendo la única vía para asignar un widget nuevo o
desasignarlo del todo. El admin no ve el estado `visible` del usuario
(si el usuario ocultó una card, para el admin sigue "asignada").

## Fuera de alcance

- Agregar widgets nuevos al propio dashboard (sigue siendo del admin).
- Reordenar mezclando KPIs y charts entre sí.
- Redimensionar/cambiar tamaño de cards.
- Deshacer un `ocultar` sin abrir modo edición (no hay "undo" flotante
  tipo snackbar — la franja de ocultos es el mecanismo de deshacer).
- Sincronización en tiempo real entre pestañas/dispositivos del mismo
  usuario (cambios se ven al recargar, no vía Supabase Realtime).

## Testing (manual, sin suite automatizada)

1. Usuario sin permiso `dashboard_widgets.assign`: entra a modo
   edición, arrastra una KPI a otra posición, sale de modo edición,
   recarga — el orden nuevo persiste.
2. Mismo usuario: oculta una card — desaparece del grid, aparece
   atenuada en la franja de ocultos.
3. Reactivar esa card desde la franja: vuelve al grid en la última
   posición, con sus datos reales cargados.
4. Ocultar todas las cards de una sección (ej. todos los charts): el
   grid de charts desaparece, franja de ocultos muestra todos.
5. Confirmar que un usuario NO puede reordenar/ocultar widgets de
   OTRO usuario (RLS: `eq('user_id', uid)` en las queries + policy
   `user_id = auth.uid()` bloquea cualquier intento aunque se
   manipule el widget_id de otro).
6. Admin en `/admin/dashboards`: asignar/desasignar widgets sigue
   funcionando igual que antes (policy `ALL` de assign intacta).
7. Simular error de red durante un drag (throttle/offline en
   DevTools): el orden local se revierte, aparece toast de error, no
   queda un estado visual inconsistente.
