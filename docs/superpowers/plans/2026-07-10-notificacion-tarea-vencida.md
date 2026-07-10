# Notificación de tarea vencida vía cron — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generar automáticamente una notificación `tarea_vencida` cuando una tarea vence, cerrando el punto pendiente del roadmap #7. El frontend (`NotificationBell.vue`, `useNotificaciones.ts`) ya soporta este tipo — solo falta el backend que lo produzca.

**Architecture:** Una sola migración SQL: habilita `pg_cron`, agrega la columna `tareas.notificada_vencida` para no duplicar avisos, una función `security definer` que detecta y notifica tareas vencidas (patrón idéntico a `fn_notificar_lead_asignado`/`fn_notificar_ticket_asignado`/`fn_notificar_tarea_asignada` ya existentes), un job de `pg_cron` que la llama cada hora, y un trigger que resetea el flag si la tarea se reabre o se reprograma. Sin cambios de frontend.

**Tech Stack:** Supabase (Postgres + RLS + `pg_cron`). Sin Nuxt/Vue en este plan.

## Global Constraints

- Las migraciones de este proyecto se aplican directo al único proyecto Supabase real (no hay branching disponible — ya se verificó en un plan anterior y devuelve error). Aplicar la migración es un cambio en producción: pausar y confirmar con el usuario antes de aplicarla.
- Nada de tests automatizados en este repo todavía — la verificación es SQL estructural y funcional (ejecutable por el agente vía `mcp__supabase__execute_sql`), no una suite de tests.
- Sin comentarios explicativos salvo que documenten un porqué no obvio (ver el resto de `supabase/migrations/*.sql` como referencia de tono).
- No se toca ningún archivo de `app/` — el frontend ya está completo para este tipo de notificación.
- Toda la lógica de negocio (detectar vencimiento, evitar duplicados, resetear el flag) vive en la base de datos — el cliente no lee ni escribe `notificada_vencida`.

---

### Task 1: Migración — función, columna y cron de tareas vencidas

**Files:**
- Create: `supabase/migrations/20260710000000_notificacion_tarea_vencida.sql`

**Interfaces:**
- Produces: función `fn_notificar_tareas_vencidas()`, columna `tareas.notificada_vencida`, job de cron `notificar-tareas-vencidas`, trigger `trg_resetear_notificada_vencida`. Nada de esto es consumido por ninguna otra tarea de este plan (es la única tarea).

- [ ] **Step 1: Escribir el archivo de migración**

```sql
-- supabase/migrations/20260710000000_notificacion_tarea_vencida.sql
--
-- Cierra el punto pendiente del roadmap: notificación tarea_vencida.
-- "Vencer" no es un evento de escritura, así que no se puede resolver con
-- un trigger normal como los otros 3 tipos de notificación ya existentes
-- (lead_asignado/ticket_asignado/tarea_asignada) — se usa pg_cron para
-- revisar tareas vencidas cada hora.

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

alter table tareas add column notificada_vencida boolean not null default false;

-- security definer: el cron corre sin auth.uid(), necesita bypasear la
-- policy de update de tareas (owner_id = auth.uid() or view_all) igual
-- que los triggers de notificación existentes.
create or replace function fn_notificar_tareas_vencidas()
returns void
language plpgsql
security definer
as $$
begin
  with vencidas as (
    update tareas
    set notificada_vencida = true
    where fecha_vencimiento < now()
      and not completada
      and not notificada_vencida
      and coalesce(owner_id, created_by) is not null
    returning id, titulo, coalesce(owner_id, created_by) as destinatario
  )
  insert into notificaciones (user_id, tipo, titulo, mensaje, entidad_tipo, entidad_id)
  select destinatario, 'tarea_vencida', 'Tarea vencida', titulo, 'tarea', id
  from vencidas;
end;
$$;

select cron.schedule(
  'notificar-tareas-vencidas',
  '0 * * * *',
  $$select fn_notificar_tareas_vencidas()$$
);

-- Si se reabre (completada true -> false) o se reprograma una tarea que
-- ya había avisado, permite que vuelva a avisar si vence de nuevo.
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

- [ ] **Step 2: Confirmar con el usuario y aplicar la migración a Supabase**

Antes de aplicar: avisar explícitamente que este paso escribe en el proyecto
Supabase real (no hay entorno de prueba separado) y esperar confirmación.

Aplicar con la tool `mcp__supabase__apply_migration`,
`name: "notificacion_tarea_vencida"`, `query` = el contenido completo del
Step 1.

- [ ] **Step 3: Verificar estructura — extensión, columna, función, trigger, cron job**

Correr con `mcp__supabase__execute_sql`:

```sql
select extname, extversion from pg_extension where extname = 'pg_cron';

select column_name, data_type, column_default
from information_schema.columns
where table_name = 'tareas' and column_name = 'notificada_vencida';

select proname from pg_proc
where proname in ('fn_notificar_tareas_vencidas', 'fn_resetear_notificada_vencida');

select tgname from pg_trigger where tgname = 'trg_resetear_notificada_vencida';

select jobname, schedule, active from cron.job where jobname = 'notificar-tareas-vencidas';
```

Expected: la extensión `pg_cron` instalada, la columna
`notificada_vencida` (`boolean`, default `false`), las dos funciones, el
trigger, y el job con `schedule = '0 * * * *'` y `active = true`.

- [ ] **Step 4: Prueba funcional — generar el aviso una sola vez**

Correr con `mcp__supabase__execute_sql` (usa el primer perfil disponible
como dueño/creador de la tarea de prueba):

```sql
with owner as (select id from profiles limit 1)
insert into tareas (entidad_tipo, entidad_id, titulo, fecha_vencimiento, completada, owner_id, created_by)
select 'lead', gen_random_uuid(), 'PRUEBA notificacion vencida', now() - interval '1 day', false, owner.id, owner.id
from owner
returning id;
```

Anotar el `id` devuelto (`<tarea_id>`). Luego:

```sql
select fn_notificar_tareas_vencidas();

select tipo, titulo, mensaje, entidad_tipo, entidad_id
from notificaciones
where entidad_tipo = 'tarea' and entidad_id = '<tarea_id>';
```

Expected: una fila con `tipo = 'tarea_vencida'`, `mensaje = 'PRUEBA
notificacion vencida'`.

- [ ] **Step 5: Prueba funcional — no duplicar el aviso**

```sql
select fn_notificar_tareas_vencidas();

select count(*) from notificaciones
where entidad_tipo = 'tarea' and entidad_id = '<tarea_id>';
```

Expected: `count = 1` (sigue habiendo una sola notificación tras la
segunda corrida).

- [ ] **Step 6: Prueba funcional — el trigger resetea el flag al reabrir/reprogramar**

```sql
update tareas
set completada = true
where id = '<tarea_id>';

update tareas
set completada = false, fecha_vencimiento = now() - interval '1 hour'
where id = '<tarea_id>';

select notificada_vencida from tareas where id = '<tarea_id>';
```

Expected: `notificada_vencida = false` tras el segundo update (el trigger
lo reseteó porque `completada` pasó de `true` a `false`).

```sql
select fn_notificar_tareas_vencidas();

select count(*) from notificaciones
where entidad_tipo = 'tarea' and entidad_id = '<tarea_id>';
```

Expected: `count = 2` (se generó un segundo aviso porque la tarea volvió a
vencer).

- [ ] **Step 7: Prueba funcional — destinatario `created_by` cuando no hay `owner_id`**

```sql
with creador as (select id from profiles limit 1)
insert into tareas (entidad_tipo, entidad_id, titulo, fecha_vencimiento, completada, owner_id, created_by)
select 'ticket', gen_random_uuid(), 'PRUEBA sin owner', now() - interval '1 day', false, null, creador.id
from creador
returning id;
```

Anotar el `id` (`<tarea_sin_owner_id>`). Luego:

```sql
select fn_notificar_tareas_vencidas();

select n.user_id, t.created_by
from notificaciones n
join tareas t on t.id = '<tarea_sin_owner_id>'
where n.entidad_tipo = 'tarea' and n.entidad_id = '<tarea_sin_owner_id>';
```

Expected: `n.user_id = t.created_by` (la notificación llegó a quien creó
la tarea, no hay `owner_id` que la reciba).

- [ ] **Step 8: Limpiar los datos de prueba**

```sql
delete from notificaciones where entidad_tipo = 'tarea' and entidad_id in ('<tarea_id>', '<tarea_sin_owner_id>');
delete from tareas where id in ('<tarea_id>', '<tarea_sin_owner_id>');
```

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260710000000_notificacion_tarea_vencida.sql
git commit -m "$(cat <<'EOF'
Agregar notificación de tarea vencida vía pg_cron

Cierra el punto pendiente del roadmap #7. fn_notificar_tareas_vencidas()
corre cada hora vía pg_cron, notifica una sola vez por tarea
(columna notificada_vencida) a coalesce(owner_id, created_by), y un
trigger resetea el flag si la tarea se reabre o se reprograma.
EOF
)"
```

---

## Self-Review (completado durante la escritura del plan)

**Cobertura del spec:**
- Habilitar `pg_cron` → Step 1 (con el `grant` requerido según la doc oficial de Supabase Cron). ✓
- Columna `notificada_vencida` → Step 1. ✓
- Función `security definer`, aviso único, destinatario `coalesce(owner_id, created_by)` → Step 1 (CTE `update ... returning` + `insert`, atómico en un solo statement: si el insert falla, el update de `notificada_vencida` se revierte también). ✓
- Cron cada hora (`0 * * * *`) → Step 1. ✓
- Trigger de reset al reabrir/reprogramar → Step 1. ✓
- Los 5 escenarios de testing manual del spec (aviso único, no duplicar, reset del flag, cron job creado, fallback a `created_by`) → Steps 3-7. ✓
- Fuera de alcance del spec (UI, navegación de la campanita, recordatorio antes de vencer, `useTareas.ts`, tests automatizados) → ningún archivo de `app/` tocado, ningún test automatizado agregado. ✓

**Placeholders:** ninguno — el archivo de migración se entrega completo. Los `<tarea_id>`/`<tarea_sin_owner_id>` en los Steps 4-8 son marcadores intencionales para IDs generados en tiempo de ejecución (no hay forma de conocerlos antes de correr el insert), se reemplazan por el valor real devuelto por cada `returning id`.

**Consistencia:** el nombre de columna (`notificada_vencida`), el de la función (`fn_notificar_tareas_vencidas`), el del trigger (`trg_resetear_notificada_vencida`) y el del job (`notificar-tareas-vencidas`) son los mismos en el Step 1 y en todos los steps de verificación/testing.
