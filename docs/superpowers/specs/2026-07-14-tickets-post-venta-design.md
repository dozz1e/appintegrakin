# Tickets de Post-venta

## Contexto

El sistema de `tickets` actual (`20260702000200_clientes_leads_tickets.sql`)
lo usa el rol `servicio_tecnico` para soporte general. El equipo de
post-venta necesita su **propio sistema de tickets**, separado, para
seguir el flujo real de reparación/garantía de equipos que hoy llevan en
una planilla con estas columnas: N° guía, F. ingreso, F. tope, Rut
cliente, Cliente, Celular, Empresa, Ciudad, Equipo, Descripción Falla,
Estado, F. despacho, Observaciones, F. seguimiento, Comentario
Seguimiento.

Decisiones tomadas durante el brainstorming:

- Es un módulo **nuevo y separado** del `tickets` de servicio_técnico
  (tablas, permisos y página distintos).
- El **N° de guía se ingresa a mano** (viene con una numeración externa
  ya definida, no se genera acá).
- El **"Equipo" se enlaza al catálogo `productos`** existente (mismo
  catálogo que usan Ventas/Capacitaciones), no es texto libre.
- La mayoría de los tickets son de un **cliente ya registrado**
  (`clientes`), pero existe el caso borde de un cliente **no
  registrado ("desconocido")** — sin tabla aparte para ese caso (ver
  Diseño).
- **Sin `owner_id`/responsable individual** — todo el equipo de
  post_venta es igual, todos ven y editan todos los tickets por igual.
- **"F. tope" se ingresa a mano** (no se calcula), y sí necesita el
  mismo patrón de aviso automático por vencimiento que `tareas`/
  `citas_capacitacion`, pero la notificación de vencido llega a **todos
  los usuarios con rol `post_venta`** (no a dueña, y no a un owner
  individual porque no existe).
- **"F. seguimiento"/"Comentario Seguimiento" es una bitácora** (varios
  seguimientos en el tiempo por ticket), no un campo único.
- Vista principal tipo **Kanban** con una columna por estado (mismo
  patrón visual que `TicketBoard.vue`, pero con 7 estados propios).
- Acceso: **solo `post_venta` y `dueña`** (servicio_técnico y el resto,
  sin acceso — se puede dar por override individual si hace falta más
  adelante).
- Ruta/nav: **`/post-venta`**, entrada de nav "Post Venta".

## Diseño

### Tabla `tickets_post_venta`

```sql
create table tickets_post_venta (
  id uuid primary key default gen_random_uuid(),
  n_guia text not null,
  cliente_id uuid references clientes(id),
  cliente_nombre_libre text,
  cliente_rut_libre text,
  cliente_celular_libre text,
  cliente_ciudad_libre text,
  producto_id uuid not null references productos(id),
  descripcion_falla text,
  estado text check (estado in (
    'pendiente_ingreso','ingreso_equipo','probando',
    'espera_repuesto','listo_despacho','despachado','desconocido'
  )) not null default 'pendiente_ingreso',
  fecha_ingreso date not null default current_date,
  fecha_tope date,
  fecha_despacho date,
  observaciones text,
  notificada_vencida boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_post_venta_cliente_check check (
    cliente_id is not null or cliente_nombre_libre is not null
  )
);

create index idx_tickets_post_venta_estado on tickets_post_venta(estado);
create index idx_tickets_post_venta_cliente on tickets_post_venta(cliente_id);
```

`fecha_ingreso`/`fecha_tope`/`fecha_despacho` son `date` (no
`timestamptz`) — a diferencia de `tareas`/`citas_capacitacion`, acá no
se pidió hora, son fechas de planilla. Evita además el problema del
gotcha #11 (sentinel de hora) porque no aplica.

`producto_id` **sin** cascade (mismo criterio que `citas_capacitacion`:
los productos no se borran, se marcan `inactivo`). `cliente_id` **sin**
cascade tampoco — a diferencia de `citas_capacitacion`, acá si se borra
un cliente con tickets post-venta abiertos no queremos perder el
historial de reparación; si se intenta borrar un cliente con tickets
asociados, el `references` (sin `on delete`) lo bloquea por FK — mismo
comportamiento por defecto que hoy tiene `ventas.cliente_id`.

Sin columna `version`/optimistic locking (mismo criterio que `tareas`/
`citas_capacitacion` — módulo chico, sin edición concurrente esperada).

### Tabla `tickets_post_venta_seguimientos` (bitácora)

```sql
create table tickets_post_venta_seguimientos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets_post_venta(id) on delete cascade,
  fecha date not null default current_date,
  comentario text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_tpv_seguimientos_ticket on tickets_post_venta_seguimientos(ticket_id);
```

Mismo concepto que `cliente_interacciones`/`lead_interacciones`: solo
insert + select, sin update/delete (bitácora de solo agregar).

### RLS

```sql
alter table tickets_post_venta enable row level security;
alter table tickets_post_venta_seguimientos enable row level security;

create policy select_tickets_post_venta on tickets_post_venta
for select using (has_permission(auth.uid(), 'tickets_post_venta', 'view'));

create policy insert_tickets_post_venta on tickets_post_venta
for insert with check (
  created_by = auth.uid()
  and has_permission(auth.uid(), 'tickets_post_venta', 'create')
);

create policy update_tickets_post_venta on tickets_post_venta
for update using (has_permission(auth.uid(), 'tickets_post_venta', 'edit'));

create policy select_tpv_seguimientos on tickets_post_venta_seguimientos
for select using (has_permission(auth.uid(), 'tickets_post_venta', 'view'));

create policy insert_tpv_seguimientos on tickets_post_venta_seguimientos
for insert with check (
  created_by = auth.uid()
  and has_permission(auth.uid(), 'tickets_post_venta', 'edit')
);
```

Sin `view`/`view_all` separados — a diferencia del resto de módulos, acá
no hay concepto de "propio" (decisión explícita: todo el equipo ve todo
por igual), así que un solo permiso `view` alcanza para ver todo.

**Sin policy de `delete`** en ninguna de las dos tablas — mismo criterio
que `tareas`/`citas_capacitacion` (no se pidió borrado; el ciclo de vida
del ticket se cierra moviéndolo a `despachado`, no borrándolo).

Nuevos permisos seed: `tickets_post_venta.view`, `.create`, `.edit`.
Asignados por defecto a `post_venta` (los 3) y `dueña` (los 3) — nadie
más los tiene por defecto.

### Notificaciones — cron de vencidos

A diferencia de `tareas`/`citas_capacitacion` (donde el destinatario es
un `owner_id` individual), acá el destinatario es **todo el rol
`post_venta`** porque no hay responsable individual:

```sql
alter table notificaciones drop constraint notificaciones_tipo_check;
alter table notificaciones add constraint notificaciones_tipo_check
  check (tipo in (
    'lead_asignado','ticket_asignado','tarea_asignada','tarea_vencida',
    'capacitacion_asignada','capacitacion_vencida',
    'ticket_post_venta_vencido'
  ));

alter table notificaciones drop constraint notificaciones_entidad_tipo_check;
alter table notificaciones add constraint notificaciones_entidad_tipo_check
  check (entidad_tipo in ('lead','cliente','ticket','tarea','ticket_post_venta'));

create or replace function fn_notificar_tickets_post_venta_vencidos()
returns void
language plpgsql
security definer
as $$
begin
  with vencidos as (
    update tickets_post_venta
    set notificada_vencida = true
    where fecha_tope < current_date
      and estado <> 'despachado'
      and not notificada_vencida
    returning id, n_guia
  ),
  destinatarios as (
    select pr.profile_id
    from profile_roles pr
    join roles r on r.id = pr.role_id
    where r.name = 'post_venta'
  )
  insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
  select d.profile_id, 'ticket_post_venta_vencido', 'Ticket post-venta vencido',
         'Guía ' || v.n_guia || ' pasó la fecha tope', 'ticket_post_venta', v.id
  from vencidos v cross join destinatarios d;
end;
$$;

select cron.schedule('notificar-tickets-post-venta-vencidos', '0 * * * *',
  $$select fn_notificar_tickets_post_venta_vencidos()$$);
```

Trigger de reset de `notificada_vencida` si `fecha_tope` cambia, o si
`estado` pasa a `despachado` y después se revierte — mismo criterio que
`fn_resetear_notificada_vencida` de tareas.

`NotificationBell.vue`: nuevo ícono en `etiquetaTipo` (🛠️ para
`ticket_post_venta_vencido`) y nueva entrada en `rutaEntidad`:
`ticket_post_venta: '/post-venta'` — a diferencia de capacitaciones (que
no tiene página de detalle propia), acá sí existe `/post-venta/[id]`,
así que el click navega directo a `` `/post-venta/${entidad_id}` ``.

**No hay notificación al crear un ticket** (a diferencia de
`tarea_asignada`/`capacitacion_asignada`) — no aplica porque no hay
asignación individual.

### `useTicketsPostVenta.ts` (nuevo composable)

```ts
export interface TicketPostVenta {
  id: string
  n_guia: string
  cliente_id: string | null
  cliente_nombre_libre: string | null
  cliente_rut_libre: string | null
  cliente_celular_libre: string | null
  cliente_ciudad_libre: string | null
  producto_id: string
  descripcion_falla: string | null
  estado: 'pendiente_ingreso' | 'ingreso_equipo' | 'probando' |
          'espera_repuesto' | 'listo_despacho' | 'despachado' | 'desconocido'
  fecha_ingreso: string
  fecha_tope: string | null
  fecha_despacho: string | null
  observaciones: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TicketPostVentaSeguimiento {
  id: string
  ticket_id: string
  fecha: string
  comentario: string
  created_by: string | null
  created_at: string
}
```

Funciones: `fetchTickets()` (listado completo, RLS ya resuelve
acceso), `crearTicket`, `actualizarTicket` (edita campos y/o
`estado`/`fecha_despacho`), `fetchSeguimientos(ticketId)`,
`agregarSeguimiento(ticketId, fecha, comentario)`.

### Página `/post-venta`

Vista **Kanban** (mismo patrón `TicketBoard.vue` con `vuedraggable`),
una columna por `estado` (7 columnas, colores propios en un
`colorEstadoPostVenta.ts` — mismo patrón que `colorCitaCapacitacion`).
Cada tarjeta: N° guía, cliente (`razon_social` o
`cliente_nombre_libre`), equipo (`productos.nombre`), fecha tope
(resaltada en rojo si `fecha_tope < hoy` y no está `despachado`).
Arrastrar una tarjeta entre columnas actualiza `estado` (`cambiarEstado`,
sin chequeo de optimistic locking, mismo criterio que `TicketBoard.vue`
actual).

Botón "+ Nuevo ticket" → `/post-venta/nuevo`: formulario con
`ClienteBuscador.vue` + toggle "Cliente no registrado" que revela los 4
campos libres (nombre/rut/celular/ciudad) y oculta el buscador,
selector de producto (`useProductos().fetchProductos()` filtrado a
`estado='activo'`), N° guía, descripción falla, fecha ingreso, fecha
tope, observaciones.

Página `/post-venta/[id]`: detalle en 2 columnas (mismo patrón
`tickets/[id].vue`) — izquierda: datos del ticket + selector de
`estado` + fecha despacho; derecha: bitácora de seguimientos (listado
ordenado por fecha desc + formulario de alta: fecha + comentario).

Nav: entrada "Post Venta" en `default.vue`, sección CRM, gateada por
`can('tickets_post_venta','view')`.

## Alternativas descartadas

- **Tabla aparte para clientes "desconocidos"**: se descartó por ser un
  caso borde raro (la mayoría son clientes reales) — agregar una tabla
  nueva con su propia RLS/composable/UI para eso sería sobre-ingeniería.
  Se resuelve con columnas nulables en la misma fila.
- **`owner_id` individual** (como el resto de módulos): se descartó
  explícitamente — el equipo de post_venta funciona sin dueño individual
  por ticket, todos ven y editan todo por igual.
- **`timestamptz` en las fechas** (como `tareas`): se descartó porque no
  se pidió hora, solo fecha — usar `date` es más simple y evita el
  sentinel de hora del gotcha #11.

## Fuera de alcance

- Sin reasignación de responsable (no existe responsable individual).
- Sin borrado de tickets ni de seguimientos (solo cambio de `estado`).
- Sin edición/borrado de un seguimiento ya cargado (bitácora de solo
  agregar, mismo criterio que interacciones).
- Sin vincular este módulo a `ventas` (no se pidió relacionar el ticket
  con una venta puntual, solo con el producto/equipo).

## Testing (manual, sin suite automatizada)

1. Con rol `post_venta`: crear un ticket con cliente registrado,
   aparece en `/post-venta` en la columna `pendiente_ingreso`.
2. Crear un ticket marcando "Cliente no registrado": se guarda con
   `cliente_id = null` y los 4 campos libres, se muestra igual en el
   Kanban con el nombre libre.
3. Un rol sin `tickets_post_venta.view` (ej. `ventas`,
   `servicio_tecnico`) no ve la entrada de nav ni puede acceder a
   `/post-venta` directamente por URL.
4. Arrastrar una tarjeta de `probando` a `espera_repuesto`: se
   actualiza `estado` y persiste tras recargar.
5. Ticket con `fecha_tope` ayer y `estado != despachado`: el cron
   genera `ticket_post_venta_vencido` para **todos** los usuarios con
   rol `post_venta` (no para `dueña`), una sola vez.
6. Cambiar `fecha_tope` de un ticket ya notificado como vencido:
   `notificada_vencida` se resetea.
7. Agregar dos seguimientos a un mismo ticket: ambos quedan visibles en
   la bitácora del detalle, ordenados por fecha.
8. Mover un ticket a `despachado`: deja de contar como vencido aunque
   `fecha_tope` ya haya pasado.
9. Intentar borrar un cliente con tickets post-venta asociados: la FK
   lo bloquea (no se borra en cascada, a diferencia de
   `citas_capacitacion`).
