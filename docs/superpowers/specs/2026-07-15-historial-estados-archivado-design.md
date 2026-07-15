# Historial de estados y archivado automático (Leads, Tickets, Post-venta)

## Contexto

Hoy `leads`, `tickets` y `tickets_post_venta` solo guardan el `estado`
actual. No hay forma de ver cuándo cambió de un estado a otro (más allá
del audit_log genérico, que solo cubre `leads`/`tickets`, no
`tickets_post_venta`, mezcla todos los campos y está gateado por el
permiso de auditoría, no pensado para uso diario del equipo). Tampoco
hay un lugar permanente para ver los leads/tickets/post-venta que ya se
cerraron, ni una forma de que los cerrados dejen de saturar el
Kanban/listado activo con el tiempo.

Decisiones tomadas durante el brainstorming:

- **"Borrar" = archivar, no eliminar.** Un registro archivado sigue en
  la base, solo desaparece del listado/Kanban activo. Nunca se pierde
  dato.
- **Estados de cierre por módulo:**
  - `leads`: `ganado`, `perdido`.
  - `tickets`: `resuelto`, `cerrado`.
  - `tickets_post_venta`: `despachado` (`desconocido` **no** cuenta como
    cierre).
- **"Historial de movimientos"** = registro de **todos** los cambios de
  estado (no solo el cierre) — nuevo→contactado→cotizado→..., visible
  por módulo.
- **"Historial de cerrados"** = listado **permanente** de todo lo que
  alguna vez llegó a un estado de cierre, con su fecha de cierre. No
  depende de si ya se archivó o no — un lead recién cerrado ayer
  aparece acá igual que uno archivado hace un año.
- **Ventana antes de archivar**: días configurables **por módulo**
  (leads / tickets / post-venta), **valor único global** (no por
  usuario) — lo usa un cron, no puede variar por quién lo mire.
- Esos 3 números viven en el modal de **Configuración** existente
  (`ConfiguracionModal.vue`, donde ya está el umbral de alertas de
  tareas), pero solo se muestran a cuentas con rol `post_venta` (según
  lo pedido). Cualquiera de esas cuentas que los edite cambia el valor
  para toda la empresa.
- **Reestructura de nav**: Leads, Tickets (renombrado "Servicio
  Técnico") y Post Venta dejan de ser un link plano dentro de "CRM" y
  pasan a ser su propia sección con 3 links cada una (Listado, Historial
  de movimientos, Historial de cerrados). CRM queda con Clientes y
  Productos solamente.
- Arquitectura: **tabla genérica compartida** `historial_estados`
  (mismo patrón `entidad_tipo`/`entidad_id` que ya usa `notificaciones`),
  no una tabla por módulo.

## Diseño

### Tabla `historial_estados`

```sql
create table historial_estados (
  id uuid primary key default gen_random_uuid(),
  entidad_tipo text check (entidad_tipo in ('lead', 'ticket', 'ticket_post_venta')) not null,
  entidad_id uuid not null,
  estado_anterior text,
  estado_nuevo text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_historial_estados_entidad on historial_estados(entidad_tipo, entidad_id);
```

`estado_anterior` es nullable para cubrir el registro que se generaría
si en el futuro se quisiera loguear también el estado inicial al crear
(no se hace en este alcance — ver "Fuera de alcance").

Sin FK real hacia `leads`/`tickets`/`tickets_post_venta` (igual que
`notificaciones.entidad_id`) — evita 3 columnas nullable de FK distintas
para un solo campo lógico.

Trigger reutilizable, mismo estilo que `registrar_auditoria()`:

```sql
create or replace function registrar_historial_estado()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.estado is distinct from old.estado then
    insert into historial_estados (entidad_tipo, entidad_id, estado_anterior, estado_nuevo, created_by)
    values (tg_argv[0], new.id, old.estado, new.estado, auth.uid());
  end if;
  return new;
end;
$$;

create trigger historial_estado_leads after update on leads
  for each row execute function registrar_historial_estado('lead');

create trigger historial_estado_tickets after update on tickets
  for each row execute function registrar_historial_estado('ticket');

create trigger historial_estado_tickets_post_venta after update on tickets_post_venta
  for each row execute function registrar_historial_estado('ticket_post_venta');
```

RLS: `select` gateado por el mismo permiso de lectura del módulo
correspondiente (`has_permission(auth.uid(), 'leads', 'view') or
has_permission(auth.uid(), 'leads', 'view_all')` para las filas
`entidad_tipo='lead'`, análogo para los otros dos). Sin policy de
insert/update/delete desde el cliente — solo el trigger (`security
definer`) escribe acá.

```sql
alter table historial_estados enable row level security;

create policy select_historial_estados on historial_estados
for select using (
  (entidad_tipo = 'lead' and (has_permission(auth.uid(), 'leads', 'view') or has_permission(auth.uid(), 'leads', 'view_all')))
  or (entidad_tipo = 'ticket' and (has_permission(auth.uid(), 'tickets', 'view') or has_permission(auth.uid(), 'tickets', 'view_all')))
  or (entidad_tipo = 'ticket_post_venta' and has_permission(auth.uid(), 'tickets_post_venta', 'view'))
);
```

### Columnas nuevas en `leads`, `tickets`, `tickets_post_venta`

```sql
alter table leads add column fecha_cierre timestamptz;
alter table leads add column archivado boolean not null default false;

alter table tickets add column fecha_cierre timestamptz;
alter table tickets add column archivado boolean not null default false;

alter table tickets_post_venta add column fecha_cierre timestamptz;
alter table tickets_post_venta add column archivado boolean not null default false;
```

Trigger por tabla (antes de `historial_estado_*`, o combinado en la
misma función `before update` para no encadenar dos triggers — se opta
por **combinarlo en una sola función `before update` por tabla**, ya
que `fecha_cierre`/`archivado` son columnas de la fila que se está
actualizando y `before` es más simple que un `after` separado):

```sql
create or replace function fn_gestionar_cierre_leads()
returns trigger
language plpgsql
as $$
begin
  if new.estado in ('ganado', 'perdido') and old.estado not in ('ganado', 'perdido') then
    new.fecha_cierre := now();
  elsif new.estado not in ('ganado', 'perdido') and old.estado in ('ganado', 'perdido') then
    new.fecha_cierre := null;
    new.archivado := false;
  end if;
  return new;
end;
$$;

create trigger gestionar_cierre_leads before update on leads
  for each row execute function fn_gestionar_cierre_leads();
```

Análogo para `tickets` (`estado in ('resuelto', 'cerrado')`) y
`tickets_post_venta` (`estado = 'despachado'`), cada uno con su propia
función (`fn_gestionar_cierre_tickets`,
`fn_gestionar_cierre_tickets_post_venta`) — no se generaliza en una
función paramétrica porque cada tabla tiene su propio set de estados de
cierre y esto es más legible que pasar arrays por `tg_argv`.

Este trigger corre **antes** que `registrar_historial_estado` (orden
alfabético de nombre de trigger dentro de Postgres: `fn_gestionar_*` /
`gestionar_cierre_*` se registra con nombre `gestionar_cierre_leads`,
`historial_estado_leads` — Postgres ejecuta los triggers `before` de una
tabla en orden alfabético por nombre antes que los `after`, así que el
orden entre ambos no importa: uno es `before` y el otro `after`, no
compiten).

### Tabla `configuracion_archivado`

```sql
create table configuracion_archivado (
  modulo text primary key check (modulo in ('leads', 'tickets', 'tickets_post_venta')),
  dias integer not null check (dias > 0)
);

insert into configuracion_archivado (modulo, dias) values
  ('leads', 30), ('tickets', 30), ('tickets_post_venta', 30);

alter table configuracion_archivado enable row level security;

create policy select_configuracion_archivado on configuracion_archivado
for select using (auth.uid() is not null);

create policy update_configuracion_archivado on configuracion_archivado
for update using (has_permission(auth.uid(), 'configuracion_archivado', 'edit'));
```

Nuevo permiso `configuracion_archivado.edit`, asignado a `post_venta` y
`dueña` por defecto (mismo criterio que el resto de permisos de este
plan). `select` abierto a cualquier autenticado — no es dato sensible y
simplifica no tener que dar `view` a todo el mundo explícitamente.

### Cron de archivado

Un cron diario (no horario — no hace falta más frecuencia para una
ventana de días) que recorre los 3 módulos:

```sql
create or replace function fn_archivar_cerrados()
returns void
language plpgsql
security definer
as $$
begin
  update leads set archivado = true
  where estado in ('ganado', 'perdido') and not archivado
    and fecha_cierre < now() - (
      (select dias from configuracion_archivado where modulo = 'leads') || ' days'
    )::interval;

  update tickets set archivado = true
  where estado in ('resuelto', 'cerrado') and not archivado
    and fecha_cierre < now() - (
      (select dias from configuracion_archivado where modulo = 'tickets') || ' days'
    )::interval;

  update tickets_post_venta set archivado = true
  where estado = 'despachado' and not archivado
    and fecha_cierre < now() - (
      (select dias from configuracion_archivado where modulo = 'tickets_post_venta') || ' days'
    )::interval;
end;
$$;

select cron.schedule('archivar-cerrados', '0 3 * * *', $$select fn_archivar_cerrados()$$);
```

Corre a las 3 AM (baja actividad, mismo criterio horario que otros
crons de mantenimiento del proyecto).

### Listados activos (filtro `archivado`)

`useLeads().fetchLeads()`, `useTickets` (fetch del Kanban) y
`useTicketsPostVenta().fetchTickets()` agregan `.eq('archivado', false)`
a la query existente. Los detalles (`/leads/[id]`, `/tickets/[id]`,
`/post-venta/[id]`) **no** filtran por archivado — si alguien tiene el
link directo a un registro archivado, lo puede seguir viendo/editando
(reabrirlo le resetea `archivado` automáticamente vía el trigger de
cierre).

### Páginas nuevas (6, patrón idéntico en los 3 módulos)

**`/leads/historial-movimientos`, `/tickets/historial-movimientos`,
`/post-venta/historial-movimientos`:**
Tabla de solo lectura: fecha, de qué estado a qué estado, quién lo
cambió (`created_by` → nombre desde `profiles`), y un link al detalle
del registro (`entidad_id`). Fuente: `historial_estados` filtrado por
`entidad_tipo`, join manual a la tabla del módulo para mostrar el
nombre/guía del registro (`select` con join a `leads`/`tickets`/
`tickets_post_venta` por `entidad_id`). Orden `created_at desc`.
Mismo permiso que la vista activa del módulo — sin permiso nuevo.

**`/leads/cerrados`, `/tickets/cerrados`, `/post-venta/cerrados`:**
Listado tipo tabla (no Kanban) de todos los registros con `estado` de
cierre, **sin** filtrar por `archivado` (ver decisión de alcance
arriba). Columnas relevantes del módulo + `fecha_cierre`. Sin acciones
de edición desde acá — es de solo lectura, el link va al detalle normal
del módulo si se necesita reabrir/editar. Mismo permiso que la vista
activa.

Los 3 composables (`useLeads`, `useTickets`, `useTicketsPostVenta`)
agregan una función `fetchHistorialMovimientos()` y
`fetchCerrados()` cada uno, siguiendo la firma de las funciones `fetch*`
que ya existen.

### Nav (`app/layouts/default.vue`)

```
CRM
  Clientes
  Productos
Leads
  Listado          → /leads
  Historial de movimientos → /leads/historial-movimientos
  Historial de cerrados    → /leads/cerrados
Servicio Técnico
  Tickets          → /tickets
  Historial de movimientos → /tickets/historial-movimientos
  Historial de cerrados    → /tickets/cerrados
Post Venta
  Tickets          → /post-venta
  Historial de movimientos → /post-venta/historial-movimientos
  Historial de cerrados    → /post-venta/cerrados
Capacitaciones / Administración / Sistema (sin cambios)
```

Cada sección nueva usa el mismo patrón visual que "Administración" hoy
(header + `SharedNavLink` planos), gateada por el mismo `can(resource,
'view')`/`can(resource, 'view_all')` que ya gatea el link actual de ese
módulo.

### `ConfiguracionModal.vue`

Agrega 3 campos numéricos (label: "Archivar leads cerrados después de
cuántos días", ídem tickets/post-venta), visibles solo si
`perfil.value?.roles.includes('post_venta')`. Se guardan con un
composable nuevo y chico, `useConfiguracionArchivado.ts`
(`fetchConfiguracion()`/`actualizarDias(modulo, dias)`), **no** en
`profiles.settings` (a diferencia del umbral de alertas) — leen/escriben
la tabla `configuracion_archivado`.

## Alternativas descartadas

- **Tabla de historial por módulo** (`lead_estado_historial`, etc.): se
  descartó por duplicar 3 veces la misma tabla/trigger/RLS sin ganancia
  real, ya que las páginas igual filtran por módulo.
- **Guardar los días en `profiles.settings`** (como el umbral de
  alertas): se descartó porque un cron global no puede leer un valor
  "por usuario" — se necesita un único valor por módulo, de ahí la
  tabla `configuracion_archivado` en vez de reusar el patrón de
  `useMiPerfil`.
- **Borrado real (hard delete)** tras los N días: se descartó
  explícitamente — "borrar" en el pedido original se interpretó como
  "sacar del listado activo", nunca eliminar datos.
- **"Historial de cerrados" solo con los ya archivados**: se descartó
  — el usuario pidió que muestre todos los cerrados desde el día que
  cerraron, no solo los que ya salieron del listado activo.

## Fuera de alcance

- No se loguea el estado inicial al crear un registro en
  `historial_estados` (solo transiciones `estado A → estado B` vía
  `update`, no el insert inicial).
- Sin acción de "reabrir" dedicada en la UI — reabrir es simplemente
  cambiar el `estado` desde el detalle existente a uno que no sea de
  cierre; el trigger se encarga de limpiar `fecha_cierre`/`archivado`
  solo.
- Sin edición de `configuracion_archivado` desde `/admin/*` — vive
  únicamente en el modal de Configuración personal, según lo pedido.
- Sin paginación server-side en las páginas de historial (se asume
  volumen manejable, mismo criterio que el resto de listados chicos del
  proyecto que no paginan) — si el volumen crece, es una mejora futura.

## Testing (manual, sin suite automatizada)

1. Mover un lead de `cotizado` a `negociacion`: aparece una fila nueva
   en `/leads/historial-movimientos` con el usuario y la fecha
   correctos.
2. Mover el mismo lead a `ganado`: `fecha_cierre` se setea, aparece en
   `/leads/cerrados`, y sigue viéndose en `/leads` (listado activo)
   porque `archivado` sigue `false`.
3. Configurar "días leads" en 0 días vía SQL directo (bypaseando el
   mínimo de la UI) y correr `select fn_archivar_cerrados()` a mano:
   el lead pasa a `archivado = true` y desaparece de `/leads`, pero
   sigue en `/leads/cerrados`.
4. Reabrir ese lead (volver a `contactado`): `archivado` vuelve a
   `false`, reaparece en `/leads` activo, y sale de `/leads/cerrados`.
5. Repetir 1-4 para `tickets` (`resuelto`/`cerrado`) y
   `tickets_post_venta` (`despachado`).
6. Cuenta sin rol `post_venta`: abre el modal de Configuración, no ve
   los 3 campos de días de archivado (solo el umbral de alertas).
7. Cuenta con rol `post_venta`: cambia "días tickets" a 15 — se refleja
   en `configuracion_archivado` y lo ve también otra cuenta `post_venta`
   distinta (valor global, no por usuario).
8. Nav: cuenta con `leads.view` pero sin `tickets.view` ni
   `tickets_post_venta.view` solo ve la sección "Leads" (con sus 3
   links), no "Servicio Técnico" ni "Post Venta".
