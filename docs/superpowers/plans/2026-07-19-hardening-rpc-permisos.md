# Hardening RPC Permisos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los hallazgos 1-4 de la auditoría RLS: `permisos_efectivos_usuario` y `usuarios_por_rol` dejan de poder usarse para leer/enumerar datos de otros usuarios, ninguna función custom queda ejecutable por `anon`/`authenticated` salvo las que la app realmente necesita, y se borran dos funciones muertas y rotas.

**Architecture:** Cambios puramente de base de datos (funciones + grants), sin tocar código de la app — ninguna firma de RPC cambia, así que `usePermissions.ts`/`useUsuarios.ts` siguen funcionando sin modificación. Verificación vía impersonación real con `set local role` + `set local request.jwt.claims` (mismo mecanismo que usó la auditoría original).

**Tech Stack:** Supabase (Postgres, RLS, grants/roles `anon`/`authenticated`).

## Global Constraints

- Ninguna firma de función cambia (mismos parámetros, mismo tipo de retorno) — cero cambios en `app/`.
- El cron (`pg_cron`) corre como `postgres`, no le afecta ningún `revoke ... from public/authenticated/anon` — no requiere ajuste aparte.
- Verificación es SQL manual vía `mcp__supabase__execute_sql` (con `begin; ... rollback;` para no dejar cambios de sesión) + prueba en navegador (usuario real).
- Spec completo: `docs/superpowers/specs/2026-07-19-hardening-rpc-permisos-design.md`.

---

## Task 1: Corregir `permisos_efectivos_usuario` y `usuarios_por_rol`

**Files:**
- Create: `supabase/migrations/20260719030000_fix_permisos_usuarios_rpc.sql`

**Interfaces:**
- Produces: `permisos_efectivos_usuario(p_user uuid)` — mismo retorno `table(resource text, action text)`, pero ahora ignora `p_user` y usa `auth.uid()` internamente. `usuarios_por_rol(p_rol text)` — mismo retorno, con guard `auth.uid() is not null` agregado.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260719030000_fix_permisos_usuarios_rpc.sql

create or replace function public.permisos_efectivos_usuario(p_user uuid)
 returns table(resource text, action text)
 language plpgsql
 stable security definer
as $function$
BEGIN
  p_user := auth.uid();

  IF EXISTS (SELECT 1 FROM superadmins WHERE user_id = p_user) THEN
    RETURN QUERY SELECT p.resource, p.action FROM permissions p;
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT p.resource, p.action
    FROM profile_roles pfr
    JOIN role_permissions rp ON rp.role_id = pfr.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE pfr.profile_id = p_user
  ),
  overrides_grant AS (
    SELECT p.resource, p.action
    FROM user_permission_overrides upo
    JOIN permissions p ON p.id = upo.permission_id
    WHERE upo.user_id = p_user AND upo.effect = 'grant'
  ),
  overrides_revoke AS (
    SELECT p.resource, p.action
    FROM user_permission_overrides upo
    JOIN permissions p ON p.id = upo.permission_id
    WHERE upo.user_id = p_user AND upo.effect = 'revoke'
  )
  SELECT base.resource, base.action FROM base
  UNION
  SELECT overrides_grant.resource, overrides_grant.action FROM overrides_grant
  EXCEPT
  SELECT overrides_revoke.resource, overrides_revoke.action FROM overrides_revoke;
END;
$function$;

create or replace function public.usuarios_por_rol(p_rol text)
 returns table(id uuid, full_name text, email text)
 language sql
 stable security definer
as $function$
  select p.id, p.full_name, p.email
  from profiles p
  join profile_roles pr on pr.profile_id = p.id
  join roles r on r.id = pr.role_id
  where r.name = p_rol and p.active = true and auth.uid() is not null
  order by p.full_name;
$function$;
```

- [ ] **Step 2: Aplicar la migración**

Usar `mcp__supabase__apply_migration` con `name: "fix_permisos_usuarios_rpc"` y el mismo `query` del Step 1.

- [ ] **Step 3: PoC — confirmar que `permisos_efectivos_usuario` ya no filtra datos ajenos**

```sql
-- Tomar un usuario normal (sin permisos de admin) y el superadmin real.
select id, full_name from profiles limit 5;
-- (usar dos ids reales de la tabla anterior en los placeholders de abajo)

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub": "<UUID_USUARIO_NORMAL>"}';
select * from permisos_efectivos_usuario('<UUID_OTRO_USUARIO_EJ_SUPERADMIN>');
rollback;
```

Expected: la fila devuelta corresponde a los permisos de
`<UUID_USUARIO_NORMAL>` (el del `sub` impersonado), NO a los del
`<UUID_OTRO_USUARIO>` pasado como parámetro. Si el usuario
impersonado no tiene permisos, debe devolver 0 filas — no las 47 del
superadmin.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260719030000_fix_permisos_usuarios_rpc.sql
git commit -m "$(cat <<'EOF'
fix: close permission-enumeration hole in permisos_efectivos_usuario

permisos_efectivos_usuario(p_user) never validated the caller against
p_user - any authenticated user could pass any UUID and read that
user's full effective permission set (confirmed live: read all 47
superadmin permissions while impersonating a regular ventas account).
Now forces p_user := auth.uid() internally, ignoring the parameter -
the frontend always passed its own id anyway, so no app change needed.

usuarios_por_rol gets a defense-in-depth auth.uid() is not null guard
(primary fix for anon access is the grant revoke in the next commit).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Revoke global de `EXECUTE` + re-grant selectivo

**Files:**
- Create: `supabase/migrations/20260719040000_revoke_public_execute_funciones.sql`

**Interfaces:**
- Consumes: inventario de 31 funciones `public` (ver spec, sección "Contexto").
- Produces: ninguna función custom queda ejecutable por `PUBLIC`; solo `has_permission`, `mis_features`, `mis_widgets`, `permisos_efectivos_usuario`, `usuarios_por_rol`, `convertir_lead_a_cliente`, `fn_conteo_tickets_cliente` quedan con `EXECUTE` explícito para `authenticated`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260719040000_revoke_public_execute_funciones.sql

revoke execute on function public.convertir_lead_a_cliente(uuid, text, text) from public;
revoke execute on function public.fn_archivar_cerrados() from public;
revoke execute on function public.fn_bump_lead_actividad() from public;
revoke execute on function public.fn_conteo_tickets_cliente(uuid) from public;
revoke execute on function public.fn_gestionar_cierre_leads() from public;
revoke execute on function public.fn_gestionar_cierre_tickets() from public;
revoke execute on function public.fn_gestionar_cierre_tickets_post_venta() from public;
revoke execute on function public.fn_incrementar_version() from public;
revoke execute on function public.fn_notificar_capacitacion_asignada() from public;
revoke execute on function public.fn_notificar_citas_vencidas() from public;
revoke execute on function public.fn_notificar_lead_asignado() from public;
revoke execute on function public.fn_notificar_leads_inactivos() from public;
revoke execute on function public.fn_notificar_tarea_asignada() from public;
revoke execute on function public.fn_notificar_tareas_vencidas() from public;
revoke execute on function public.fn_notificar_ticket_asignado() from public;
revoke execute on function public.fn_notificar_tickets_post_venta_vencidos() from public;
revoke execute on function public.fn_resetear_notificada_vencida() from public;
revoke execute on function public.fn_resetear_notificada_vencida_citas() from public;
revoke execute on function public.fn_resetear_notificada_vencida_tpv() from public;
revoke execute on function public.fn_resetear_notificado_inactividad() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.has_permission(uuid, text, text) from public;
revoke execute on function public.mis_features() from public;
revoke execute on function public.mis_widgets() from public;
revoke execute on function public.permisos_efectivos_usuario(uuid) from public;
revoke execute on function public.proteger_cambio_rol() from public;
revoke execute on function public.registrar_auditoria() from public;
revoke execute on function public.registrar_historial_estado() from public;
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.usuarios_por_rol(text) from public;

grant execute on function public.has_permission(uuid, text, text) to authenticated;
grant execute on function public.mis_features() to authenticated;
grant execute on function public.mis_widgets() to authenticated;
grant execute on function public.permisos_efectivos_usuario(uuid) to authenticated;
grant execute on function public.usuarios_por_rol(text) to authenticated;
grant execute on function public.convertir_lead_a_cliente(uuid, text, text) to authenticated;
grant execute on function public.fn_conteo_tickets_cliente(uuid) to authenticated;
```

- [ ] **Step 2: Aplicar la migración**

Usar `mcp__supabase__apply_migration` con `name: "revoke_public_execute_funciones"` y el mismo `query` del Step 1.

- [ ] **Step 3: Verificar grants resultantes**

```sql
select p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;
```

Expected: `anon_exec = false` en TODAS las filas. `auth_exec = true`
solo en `has_permission`, `mis_features`, `mis_widgets`,
`permisos_efectivos_usuario`, `usuarios_por_rol`,
`convertir_lead_a_cliente`, `fn_conteo_tickets_cliente` — el resto
`auth_exec = false`.

- [ ] **Step 4: PoC — confirmar que las funciones de cron ya no son invocables por nadie**

```sql
begin;
set local role anon;
select fn_notificar_leads_inactivos();
rollback;
```

Expected: error `permission denied for function fn_notificar_leads_inactivos`.

- [ ] **Step 5: PoC — confirmar que `usuarios_por_rol` sigue funcionando para un usuario logueado normal**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub": "<UUID_USUARIO_NORMAL>"}';
select * from usuarios_por_rol('ventas');
rollback;
```

Expected: devuelve filas normalmente (no bloqueado — el revoke fue
solo sobre `anon`/`public`, `authenticated` mantiene el grant
explícito).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260719040000_revoke_public_execute_funciones.sql
git commit -m "$(cat <<'EOF'
fix: revoke default PUBLIC execute grant from all custom functions

Postgres grants EXECUTE to PUBLIC by default on function creation, and
no migration in this project ever revoked it - every custom function,
including cron-only ones like fn_notificar_leads_inactivos and
fn_archivar_cerrados, was callable by anon (unauthenticated, using
only the public bundled API key) via the PostgREST RPC endpoint.

Revokes from PUBLIC across all 30 custom functions, then re-grants
EXECUTE to authenticated only for the ones the app actually calls via
supabase.rpc() (all already self-scoped by auth.uid() or validate
permissions internally). Cron-only and trigger functions get no grant
at all - pg_cron runs as postgres, unaffected by this.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Borrar `mover_lead_estado`/`mover_ticket_estado`

**Files:**
- Create: `supabase/migrations/20260719050000_drop_funciones_muertas.sql`

**Interfaces:**
- Consumes: confirmación de que ninguna función se usa en `app/` (ya verificado en el spec — `grep` sin resultados).

- [ ] **Step 1: Confirmar de nuevo que no se usan (antes de borrar)**

```bash
grep -rn "mover_lead_estado\|mover_ticket_estado" "/run/media/Respaldo/Trabajo/claude/appintegrakin/app"
```

Expected: sin resultados (0 matches). Si aparece algún resultado, DETENERSE y no continuar con este task — reportar al usuario en vez de borrar una función en uso.

- [ ] **Step 2: Escribir y aplicar la migración**

```sql
-- supabase/migrations/20260719050000_drop_funciones_muertas.sql

drop function if exists public.mover_lead_estado(uuid, text);
drop function if exists public.mover_ticket_estado(uuid, text);
```

Usar `mcp__supabase__apply_migration` con `name: "drop_funciones_muertas"` y este `query`.

- [ ] **Step 3: Verificar que ya no existen**

```sql
select proname from pg_proc where proname in ('mover_lead_estado', 'mover_ticket_estado');
```

Expected: 0 filas.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260719050000_drop_funciones_muertas.sql
git commit -m "$(cat <<'EOF'
chore: drop dead mover_lead_estado/mover_ticket_estado functions

Both called has_permission() with 2 args (real signature takes 3),
so they've always failed at runtime - dead code, unused (useLeads.ts/
useTickets.ts change state via direct .update() calls). Flagged in
the RLS audit as a time bomb: if someone "fixed" the arg-count bug
without reviewing the rest, the ownership check evaluates NULL (from
auth.uid() under an anonymous caller) as false in plpgsql, which
would let anyone move any lead/ticket to any state with no login.
Deleting instead of fixing - nothing depends on them.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Regenerar tipos + verificación manual final (usuario)

**Files:**
- Modify: `app/types/database.types.ts` (regenerado, no a mano)

- [ ] **Step 1: Regenerar tipos TypeScript**

Usar `mcp__supabase__generate_typescript_types`, parsear el JSON de
salida (campo `types`) y escribir el resultado completo en
`app/types/database.types.ts` (mismo procedimiento ya usado en este
proyecto: `node -e "..."` para extraer y sobreescribir el archivo).

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: `✨ Build complete!` sin errores (ninguna firma de función
cambió, así que los tipos generados no deberían romper nada en
`usePermissions.ts`/`useUsuarios.ts`).

- [ ] **Step 3: Commit**

```bash
git add app/types/database.types.ts
git commit -m "$(cat <<'EOF'
chore: regenerate database types after RPC hardening migrations

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Pasar la checklist de verificación final al usuario**

1. Login normal en la app: el dashboard carga permisos
   (`usePermissions`) y muestra el nav/botones correctos según el rol
   — confirma que `permisos_efectivos_usuario` sigue funcionando para
   el propio usuario.
2. Selector de vendedor en `/leads` y filtro de vendedor en
   `/clientes`: siguen mostrando la lista de vendedoras — confirma
   que `usuarios_por_rol` sigue funcionando para `authenticated`.
3. Kanban de leads/tickets: drag & drop entre columnas sigue
   funcionando con normalidad — confirma que borrar
   `mover_lead_estado`/`mover_ticket_estado` (código muerto) no rompió
   nada real.
4. Esperar a la próxima corrida horaria del cron (o revisar
   `select * from cron.job_run_details order by start_time desc limit
   10;`) — sin errores nuevos de permiso en los jobs
   `notificar-tareas-vencidas`, `notificar-leads-inactivos`,
   `notificar-tickets-post-venta-vencidos`, `archivar-cerrados`.
