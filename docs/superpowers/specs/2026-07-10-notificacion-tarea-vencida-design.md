# Notificación de tarea vencida vía cron

## Contexto

Cierra el punto pendiente del roadmap #7 (Notificaciones): la tabla
`notificaciones` ya soporta el tipo `tarea_vencida` en su constraint
(`20260707020000_notificaciones.sql`) y el frontend ya está listo para
mostrarlo (`NotificationBell.vue` ya mapea el emoji ⏰ para ese tipo), pero
nunca se genera porque "vencer" no es un evento de escritura — depende del
paso del tiempo, no de un `INSERT`/`UPDATE`, así que no se puede resolver
con un trigger normal como los otros tres tipos (`lead_asignado`,
`ticket_asignado`, `tarea_asignada`).

`pg_cron` está disponible como extensión en el proyecto Supabase
(`default_version 1.6.4`) pero no está habilitada todavía
(`installed_version: null`).

## Approach

`pg_cron` + una función `plpgsql` `security definer` (mismo patrón que
`fn_notificar_lead_asignado`/`fn_notificar_ticket_asignado`/
`fn_notificar_tarea_asignada`), programada para correr cada hora. Todo vive
en Postgres, sin Edge Function ni servicio externo.

Se descarta resolverlo con un trigger (no aplica, ver arriba) y con una
Edge Function + cron externo (agrega infraestructura — deploy, secreto de
service role, servicio de terceros — que no aporta nada frente a tener
`pg_cron` ya disponible en el proyecto).

## Decisiones de producto (validadas con el usuario)

1. **Aviso único, no repetido.** Cada tarea vencida se notifica una sola
   vez, no en cada corrida del cron mientras siga sin completarse.
2. **Frecuencia del cron: cada hora** (`0 * * * *`). Balance entre
   inmediatez y carga — al ser aviso único, correr más seguido no aporta
   mucho.
3. **Destinatario: `coalesce(owner_id, created_by)`.** Si la tarea no tiene
   `owner_id` asignado, se notifica a quien la creó, para que ninguna tarea
   vencida quede completamente silenciosa.

## Schema

### Migración nueva: habilitar `pg_cron`

```sql
create extension if not exists pg_cron;
```

### Columna nueva en `tareas`

```sql
alter table tareas add column notificada_vencida boolean not null default false;
```

Marca si ya se generó el aviso de vencimiento para esta tarea, para no
duplicarlo en corridas sucesivas del cron.

### Función `fn_notificar_tareas_vencidas()`

`security definer`, recorre `tareas` donde `fecha_vencimiento < now()`,
`completada = false` y `notificada_vencida = false`. Por cada una: inserta
en `notificaciones` (`user_id = coalesce(owner_id, created_by)`,
`tipo = 'tarea_vencida'`, `titulo = 'Tarea vencida'`, `mensaje = titulo` de
la tarea, `entidad_tipo = 'tarea'`, `entidad_id = tareas.id`) y marca
`notificada_vencida = true` en la misma transacción, para que ambas cosas
queden atómicas (si el insert falla, no se marca como notificada).

Filtro adicional: solo tareas con `coalesce(owner_id, created_by)` no nulo
— si ninguna de las dos columnas tiene valor (no debería pasar en la
práctica, `created_by` se llena siempre al crear), no hay a quién
notificar y se omite esa fila en vez de fallar el insert por
`user_id not null`.

### Cron

```sql
select cron.schedule(
  'notificar-tareas-vencidas',
  '0 * * * *',
  $$select fn_notificar_tareas_vencidas()$$
);
```

### Reset del flag al reabrir/reprogramar una tarea

Trigger `before update` en `tareas`: si `notificada_vencida` es `true` y la
fila entrante cambia `fecha_vencimiento` a un valor distinto, o
`completada` pasa de `true` a `false`, resetear `notificada_vencida` a
`false` — para que la tarea pueda volver a avisar si vuelve a vencer.

```sql
create or replace function fn_resetear_notificada_vencida()
returns trigger
language plpgsql
as $$
begin
  if old.notificada_vencida
     and (new.fecha_vencimiento is distinct from old.fecha_vencimiento
          or (old.completada and not new.completada)) then
    new.notificada_vencida := false;
  end if;
  return new;
end;
$$;

create trigger trg_resetear_notificada_vencida before update on tareas
  for each row execute function fn_resetear_notificada_vencida();
```

## Fuera de alcance

- No se agrega UI nueva — el frontend ya está listo para el tipo
  `tarea_vencida` (`NotificationBell.vue`, `useNotificaciones.ts`).
- No se resuelve la navegación al hacer click en una notificación de tipo
  `tarea_vencida` (`rutaEntidad['tarea']` sigue vacío en
  `NotificationBell.vue` — las tareas no tienen página propia). Ya era así
  para `tarea_asignada`, no es parte de este cambio.
- No se agrega ningún mecanismo de "recordatorio antes de vencer" (ej.
  avisar 1 día antes) — solo el aviso de que ya venció.
- No se toca `useTareas.ts` en el frontend — el flag `notificada_vencida`
  se gestiona enteramente en la base de datos (función + trigger), sin
  necesidad de que el cliente lo lea ni lo escriba.
- No se agrega testing automatizado del cron (consistente con el resto
  del repo, que no tiene suite de tests todavía).

## Testing (manual, sin suite automatizada aún)

1. Crear una tarea de prueba con `fecha_vencimiento` en el pasado y
   `completada = false`. Ejecutar manualmente
   `select fn_notificar_tareas_vencidas();` en el SQL Editor y confirmar
   que aparece una notificación nueva en la campanita del usuario
   correspondiente (`owner_id` si existe, si no `created_by`).
2. Ejecutar la función una segunda vez sin cambiar nada y confirmar que
   **no** se duplica la notificación (por `notificada_vencida = true`).
3. Marcar esa tarea como `completada = true` y luego volver a
   `completada = false` con una nueva `fecha_vencimiento` en el pasado.
   Confirmar que el trigger resetea `notificada_vencida` y que la función
   vuelve a generar el aviso.
4. Confirmar que `select cron.job` lista el job
   `notificar-tareas-vencidas` con el schedule `0 * * * *` tras aplicar la
   migración.
5. Crear una tarea sin `owner_id` (solo `created_by`) vencida, correr la
   función y confirmar que la notificación llega a `created_by`.
