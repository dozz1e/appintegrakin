# Agenda de capacitaciones

## Contexto

El rol `capacitaciones` existe desde el seed inicial
(`20260702000600_seed_roles_permisos.sql`) pero con permisos vacíos
(`"capacitaciones": []`, descrito como "sin acceso a clientes/leads/
tickets en el MVP") — es un placeholder sin módulo propio construido.

Se pide una agenda para que este rol registre capacitaciones a
**clientes externos** sobre un **producto puntual del catálogo**
(`productos`, ver `20260713000000_productos.sql`), con recordatorio
igual al que ya existe para tareas (`RecordatorioAlert` +
`notificaciones`).

Decisiones tomadas durante el brainstorming:

- Capacitaciones son **con clientes** (no personal interno).
- **Un cliente por cita** (no sesiones grupales) — si hay un grupo, se
  agenda una cita por cliente.
- Solo **capacitaciones + dueña** pueden crear/agendar (mismo criterio
  de permiso que el resto de módulos, no abierto a vendedores).
- Citas **puntuales**, sin recurrencia/series.
- Vista de **lista con filtro de fecha** (no calendario visual tipo
  grilla — se descarta por costo de UI, ver "Alternativas descartadas").
- Vive en **página propia `/capacitaciones`** en el nav, no como tab
  dentro de `ClienteSplitView.vue`.
- Estados: `pendiente` / `completada` / `cancelada`.
- Solo **fecha y hora de inicio** (sin hora de fin/duración).
- **Producto obligatorio** (FK a `productos`, no texto libre).
- Notificaciones: mismo patrón que `tareas` — aviso en la campana al
  asignar responsable, y aparece en el popup `RecordatorioAlert` si
  está por vencer/vencida.
- Visibilidad `view`/`view_all` igual que el resto de módulos (el rol
  `capacitaciones` ve las suyas, `dueña` ve todas).

## Diseño

### Tabla `citas_capacitacion`

```sql
create table citas_capacitacion (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  producto_id uuid not null references productos(id),
  titulo text not null,           -- tema/agenda puntual de la sesión
  notas text,
  fecha_hora timestamptz not null,
  estado text check (estado in ('pendiente','completada','cancelada')) not null default 'pendiente',
  owner_id uuid references profiles(id),   -- responsable/instructor
  created_by uuid references profiles(id),
  notificada_vencida boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_citas_capacitacion_owner on citas_capacitacion(owner_id) where estado = 'pendiente';
create index idx_citas_capacitacion_cliente on citas_capacitacion(cliente_id);
```

`cliente_id` con `on delete cascade` (si se borra el cliente, se borran
sus citas — mismo criterio que `cliente_interacciones`). `producto_id`
**sin** cascade: los productos no se borran de verdad, solo se marcan
`inactivo` (patrón ya establecido en el catálogo), así que no hace
falta manejar ese borrado.

Sin columna `version`/optimistic locking — módulo chico, sin edición
concurrente esperada (mismo criterio que `tareas`, que tampoco la
tiene).

### RLS

```sql
alter table citas_capacitacion enable row level security;

create policy select_citas_capacitacion on citas_capacitacion
for select using (
  owner_id = auth.uid()
  or has_permission(auth.uid(), 'capacitaciones', 'view_all')
);

create policy insert_citas_capacitacion on citas_capacitacion
for insert with check (
  created_by = auth.uid()
  and has_permission(auth.uid(), 'capacitaciones', 'create')
);

create policy update_citas_capacitacion on citas_capacitacion
for update using (
  owner_id = auth.uid()
  or has_permission(auth.uid(), 'capacitaciones', 'view_all')
);
```

**Sin policy de `delete`** — mismo criterio que `tareas` (que tampoco
tiene una): con RLS activo y sin policy, nadie puede borrar filas vía
API; "eliminar" una cita en la práctica es marcarla `cancelada`
(`estado`), que ya cubre el caso de uso sin necesitar un permiso de
borrado real ni exponer esa acción en la UI.

Nuevos permisos seed: `capacitaciones.view`, `.view_all`, `.create`.
**Sin `.edit` separado** — igual que `tareas`, editar una cita la
decide `owner_id`/`view_all` en la policy de `update`, no un permiso de
acción distinto (a diferencia de `productos`, que al no tener
`owner_id` sí necesita un `edit` explícito). Asignados por defecto a
`dueña` (todo) y `capacitaciones` (`view`, `create`; sin `view_all` —
igual criterio que `ventas` con `clientes`).

**Gotcha #16 del proyecto aplica acá**: el composable debe filtrar
explícitamente por `owner_id` en `fetchMisCitasPendientes()` para el
popup de recordatorio, sin confiar en que RLS ya acota — si no,
`view_all` (dueña o cualquier rol futuro con ese permiso) mostraría
avisos de citas ajenas en su propio popup.

### Tabla `citas_descartadas`

Mismo patrón exacto que `tareas_descartadas`
(`20260714010000_tareas_descartadas.sql`) — descarte del alert por
usuario, persistido server-side (no `localStorage`, ya sabemos por qué
no sirve: no persiste en incógnito ni entre dispositivos).

```sql
create table citas_descartadas (
  user_id uuid not null references profiles(id),
  cita_id uuid not null references citas_capacitacion(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, cita_id)
);

alter table citas_descartadas enable row level security;

create policy select_citas_descartadas on citas_descartadas
for select using (user_id = auth.uid());

create policy insert_citas_descartadas on citas_descartadas
for insert with check (user_id = auth.uid());

create policy delete_citas_descartadas on citas_descartadas
for delete using (user_id = auth.uid());
```

### Notificaciones (campana)

Trigger al insertar una cita, igual patrón que
`fn_notificar_tarea_asignada`: si `owner_id` está definido y es
distinto de `created_by`, inserta en `notificaciones`
(`tipo='capacitacion_asignada'`, `entidad_tipo='cliente'`,
`entidad_id=cliente_id`, `titulo`/`mensaje` con el nombre del cliente y
el producto). `NotificationBell.vue` necesita un ícono nuevo en
`etiquetaTipo` (🎓) — el resto del componente no cambia, ya resuelve
`rutaEntidad['cliente']` a `/clientes/{id}`.

### Cron de vencidas

Job nuevo `notificar-citas-vencidas`, igual patrón que
`fn_notificar_tareas_vencidas` (`20260710000000_notificacion_tarea_vencida.sql`):

```sql
create or replace function fn_notificar_citas_vencidas()
returns void
language plpgsql
security definer
as $$
begin
  with vencidas as (
    update citas_capacitacion
    set notificada_vencida = true
    where fecha_hora < now()
      and estado = 'pendiente'
      and not notificada_vencida
      and owner_id is not null
    returning id, cliente_id, owner_id
  )
  insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
  select v.owner_id, 'capacitacion_vencida', 'Capacitación vencida',
         c.razon_social, 'cliente', v.cliente_id
  from vencidas v join clientes c on c.id = v.cliente_id;
end;
$$;

select cron.schedule('notificar-citas-vencidas', '0 * * * *',
  $$select fn_notificar_citas_vencidas()$$);
```

Trigger de reset de `notificada_vencida` si se reprograma
(`fecha_hora` cambia) o se reabre (`estado` vuelve a `pendiente` desde
`cancelada`/`completada`) — mismo criterio que
`fn_resetear_notificada_vencida`.

### `useCitasCapacitacion.ts` (nuevo composable)

Mismo shape que `useTareas.ts`:

```ts
export interface CitaCapacitacion {
  id: string
  cliente_id: string
  producto_id: string
  titulo: string
  notas: string | null
  fecha_hora: string
  estado: 'pendiente' | 'completada' | 'cancelada'
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
```

Funciones: `fetchCitas()` (listado completo para `/capacitaciones`,
RLS ya filtra propio/todo), `crearCita`, `actualizarCita` (edita campos
y/o cambia `estado`), `fetchCitasProximas()` (filtra explícito por
`owner_id`/`created_by`, igual criterio que
`fetchMisTareasPendientes`), `descartarCitaProxima`,
`cargarDescartadasGuardadas`.

### Página `/capacitaciones`

Listado ordenado por `fecha_hora`, con:
- Filtro de fecha (desde/hasta) + atajos "Hoy"/"Esta semana" (mismo
  patrón de inputs `type="date"` ya usado en `ClienteSplitView.vue`).
- Cada fila: cliente (`razon_social`), producto (`nombre`), fecha/hora,
  badge de estado (`colorEstado`-style, ver `estadoColores.ts`),
  acciones Editar / Completar / Cancelar.
- Botón "+ Nueva capacitación": formulario con `ClienteBuscador.vue`
  (ya existe, mismo componente que usa `TicketForm`/`LeadForm` para
  elegir cliente), selector de producto (`select` sobre
  `useProductos().fetchProductos()`, filtrado a `estado='activo'`),
  fecha + hora, notas, selector de responsable (`useUsuarios()`,
  default: usuario actual).

Nav: entrada "Capacitaciones" en `default.vue`, gateada por
`can('capacitaciones','view') || can('capacitaciones','view_all')`.

### `RecordatorioAlertContainer.vue` — fuente combinada

Se generaliza para mezclar dos fuentes en un solo array ordenado por
fecha:

```ts
const { tareasProximas, ... } = useTareas()
const { citasProximas, ... } = useCitasCapacitacion()

const avisos = computed(() =>
  [
    ...tareasProximas.value.map((t) => ({ id: t.id, tipo: 'tarea' as const, titulo: t.titulo, fecha: t.fecha_vencimiento })),
    ...citasProximas.value.map((c) => ({ id: c.id, tipo: 'cita' as const, titulo: `Capacitación: ${c.productoNombre} — ${c.clienteNombre}`, fecha: c.fecha_hora })),
  ].sort((a, b) => new Date(a.fecha!).getTime() - new Date(b.fecha!).getTime())
)
```

`SharedRecordatorioAlert.vue` no cambia de props (`{id, titulo,
fecha_vencimiento}`) — el container arma el objeto con esa forma antes
de pasarlo, sin tocar el componente presentacional. Click en un aviso
de tipo `cita` navega a `/capacitaciones` (la agenda es la acción,
distinto de tareas que van a la entidad relacionada — no hay una
página de detalle propia por cita). Descarte llama a
`descartarCitaProxima`/`descartarTareaProxima` según el `tipo` del
aviso.

`clienteNombre`/`productoNombre` se resuelven en
`fetchCitasProximas()` con un `select` que hace join a `clientes` y
`productos` (mismo patrón que otros `fetch*` del proyecto que traen
datos relacionados en un solo query).

## Alternativas descartadas

- **Calendario visual (grilla mes/semana)**: se evaluó y se descartó
  por costo de UI (arrastrar, resolver superposición, librería de
  calendario) frente al beneficio para un volumen de citas que no lo
  justifica hoy. Si en el futuro se necesita, es una vista adicional
  sobre los mismos datos (`citas_capacitacion`), no requiere cambiar el
  modelo.
- **Reusar la tabla `tareas` directamente** (cita = tarea con
  `entidad_tipo='cliente'`): se descartó porque los permisos quedarían
  atados a `tareas` en vez de a `capacitaciones` (el pedido explícito
  era permisos propios de este rol), y se pierde el estado `cancelada`
  (tareas solo tiene `completada` boolean).

## Fuera de alcance

- Sin recurrencia/series de citas.
- Sin hora de fin/duración ni detección de superposición de agenda.
- Sin vista de calendario (grilla) — solo lista con filtro de fecha.
- Sin tab "Capacitaciones" dentro de `ClienteSplitView.vue` — solo
  página propia `/capacitaciones`.
- Sin reasignar responsable después de creada (si hace falta, se
  cancela y se crea de nuevo) — no se pidió edición de `owner_id` post
  creación.

## Testing (manual, sin suite automatizada)

1. Con rol `capacitaciones` sin `view_all`: crear una cita para un
   cliente propio, aparece en `/capacitaciones`; una cita de otro
   usuario del mismo rol no aparece.
2. Con `dueña` (`view_all`): ve todas las citas de todos los usuarios
   de `capacitaciones`.
3. Un rol sin `capacitaciones.create` (ej. `ventas`) no puede crear
   citas ni ve la entrada de nav.
4. Crear cita con `owner_id` distinto del creador: el responsable
   recibe notificación `capacitacion_asignada` en la campana.
5. Crear cita con `fecha_hora` 15 minutos en el futuro: aparece en el
   popup `RecordatorioAlert` junto con las tareas próximas, ordenado
   por fecha.
6. Cerrar (✕) el aviso de una cita: no reaparece tras recargar ni en
   otro navegador/incógnito (verifica `citas_descartadas`).
7. Cita vencida sin marcarse completada: a la hora, el cron genera
   notificación `capacitacion_vencida` una sola vez; el popup la sigue
   mostrando (en rojo, vencida) hasta que se marca completada o
   cancelada.
8. Reprogramar `fecha_hora` de una cita ya notificada como vencida:
   `notificada_vencida` se resetea, puede volver a avisar si vence de
   nuevo.
9. Marcar como `completada` o `cancelada`: desaparece del popup y deja
   de contar como pendiente, pero sigue visible en el listado
   `/capacitaciones` con su badge de estado.
10. Borrar un cliente con citas asociadas: sus citas se borran en
    cascada (no quedan huérfanas).
