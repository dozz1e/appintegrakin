# Hardening de permisos en funciones RPC (hallazgos 1-4 de auditoría RLS)

## Contexto

Auditoría de seguridad de RLS (fork dedicado, sesión del
2026-07-19) encontró que **ninguna migración del proyecto revocó
nunca `EXECUTE` de `PUBLIC`** al crear funciones — Postgres lo otorga
por defecto. Confirmado en vivo con impersonación real
(`set local request.jwt.claims`): un usuario sin ningún permiso de
admin pudo leer los 47 permisos del superadmin llamando
`permisos_efectivos_usuario` con su UUID. `usuarios_por_rol` además
tiene `EXECUTE` otorgado a `anon` — invocable sin login, con la clave
pública del bundle JS.

Se cubren acá los hallazgos 1-4 de la auditoría (críticos/altos +
uno medio trivial de resolver de paso — `mover_lead_estado`/
`mover_ticket_estado`, código muerto y roto). Hallazgos 5-6 (Storage:
`entidad-imagenes`, `clientes-imagenes`) y 7-8 (informativos) quedan
para specs separadas — no se pidieron en este pase.

Inventario completo de funciones `public` y sus grants actuales
(`has_function_privilege`), verificado hoy:
- **Cron-only, nunca deberían ser callables por ningún rol de
  cliente** (`pg_cron` corre como `postgres`, no le afecta el
  revoke): `fn_archivar_cerrados()`, `fn_notificar_citas_vencidas()`,
  `fn_notificar_leads_inactivos()`, `fn_notificar_tareas_vencidas()`,
  `fn_notificar_tickets_post_venta_vencidos()`.
- **Trigger functions** (`returns trigger` — Postgres ya bloquea
  llamarlas fuera de un trigger con error nativo, no explotables
  directo, pero se les saca el grant igual por prolijidad):
  `fn_bump_lead_actividad`, `fn_gestionar_cierre_leads`,
  `fn_gestionar_cierre_tickets`, `fn_gestionar_cierre_tickets_post_venta`,
  `fn_incrementar_version`, `fn_notificar_capacitacion_asignada`,
  `fn_notificar_lead_asignado`, `fn_notificar_tarea_asignada`,
  `fn_notificar_ticket_asignado`, `fn_resetear_notificada_vencida`,
  `fn_resetear_notificada_vencida_citas`,
  `fn_resetear_notificada_vencida_tpv`,
  `fn_resetear_notificado_inactividad`, `handle_new_user`,
  `proteger_cambio_rol`, `registrar_auditoria`,
  `registrar_historial_estado`, `rls_auto_enable`.
- **Llamadas por la app, necesitan quedar disponibles para
  `authenticated`** (ya validadas en la auditoría — cada una
  self-scoped por `auth.uid()` internamente, o con chequeo de
  permiso propio): `has_permission(uuid, text, text)`,
  `mis_features()`, `mis_widgets()`, `permisos_efectivos_usuario(uuid)`
  (se corrige acá), `usuarios_por_rol(text)` (se corrige acá),
  `convertir_lead_a_cliente(uuid, text, text)`,
  `fn_conteo_tickets_cliente(uuid)` (esta última ya tenía
  `anon_exec: false` — confirma que si se revoca a mano el patrón
  funciona, es la excepción que prueba la regla).
- **Muertas, rotas, se borran**: `mover_lead_estado(uuid, text)`,
  `mover_ticket_estado(uuid, text)`.

## Diseño

### 1. `permisos_efectivos_usuario` — forzar `p_user` al usuario real

```sql
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
```

(Único cambio real: `p_user := auth.uid();` como primera línea del
`BEGIN`. El resto del cuerpo queda idéntico — se reproduce completo
porque `create or replace function` exige el cuerpo entero.)

La firma `(p_user uuid)` no cambia — `usePermissions.ts:27-29` sigue
llamando igual (`{ p_user: user.value.sub }`), ese valor ahora se
ignora silenciosamente adentro. No rompe nada porque el frontend
siempre pidió su propio id de todos modos.

### 2. `usuarios_por_rol` — guard interno + grants

```sql
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

(Único cambio: `and auth.uid() is not null` agregado al `where`.)

### 3. Revoke global + re-grant selectivo

```sql
-- Revoca EXECUTE de PUBLIC (incluye anon Y authenticated) en TODAS
-- las funciones custom del schema public. Re-otorga explícito solo a
-- authenticated donde la app realmente lo necesita.

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

-- Re-grant explícito solo para las que la app llama vía supabase.rpc().
grant execute on function public.has_permission(uuid, text, text) to authenticated;
grant execute on function public.mis_features() to authenticated;
grant execute on function public.mis_widgets() to authenticated;
grant execute on function public.permisos_efectivos_usuario(uuid) to authenticated;
grant execute on function public.usuarios_por_rol(text) to authenticated;
grant execute on function public.convertir_lead_a_cliente(uuid, text, text) to authenticated;
grant execute on function public.fn_conteo_tickets_cliente(uuid) to authenticated;
```

`fn_notificar_*`/`fn_archivar_cerrados` y las funciones trigger NO se
re-otorgan a nadie — quedan sin ningún rol de cliente con `EXECUTE`.
`pg_cron` las sigue pudiendo llamar porque corre como `postgres`
(dueño de la base), ajeno por completo al sistema de grants de
`anon`/`authenticated` que usa PostgREST.

### 4. Borrar funciones muertas

```sql
drop function if exists public.mover_lead_estado(uuid, text);
drop function if exists public.mover_ticket_estado(uuid, text);
```

Confirmado sin uso: `grep` en `app/` no encuentra ninguna llamada
`supabase.rpc('mover_lead_estado'` ni `'mover_ticket_estado'` —
`useLeads.ts`/`useTickets.ts` cambian estado con `.update()` directo.

## Fuera de alcance

- Hallazgos 5 y 6 de la auditoría (Storage `entidad-imagenes` y
  `clientes-imagenes` sin scoping por ownership) — spec separada.
- Hallazgos 7 y 8 (informativos: `has_permission` con `p_user`
  arbitrario de menor severidad, `profiles`/`roles` legibles por
  cualquier autenticado) — no se tocan, el segundo probablemente es
  intencional (directorio interno), se confirma con el usuario en
  otro momento si hace falta.
- No se agrega un mecanismo genérico que fuerce revocar `PUBLIC`
  automáticamente en migraciones futuras (ej. `ALTER DEFAULT
  PRIVILEGES`) — cada función nueva deberá seguir este mismo patrón a
  mano. Se documenta como advertencia para el futuro, no como tarea
  de este spec.

## Testing (manual, vía SQL editor / execute_sql)

1. Repetir el PoC de la auditoría: `set local role authenticated; set
   local request.jwt.claims = '{"sub": "<uuid de un usuario normal>"}';
   select * from permisos_efectivos_usuario('<uuid de OTRO usuario,
   ej. superadmin>');` (dentro de `begin; ... rollback;`) — debe
   devolver los permisos del usuario impersonado (el del `sub`), NO
   los del UUID pasado como parámetro.
2. `set local role anon; select * from usuarios_por_rol('dueña');` —
   debe fallar con error de permiso denegado (`EXECUTE` revocado),
   no devolver filas.
3. `set local role authenticated; set local request.jwt.claims =
   '{"sub": "<uuid válido>"}'; select * from usuarios_por_rol('ventas');`
   — debe seguir funcionando igual que antes (usado por los
   selectores de vendedor en `/leads`, `/clientes`).
4. `set local role anon; select fn_notificar_leads_inactivos();` —
   debe fallar con error de permiso denegado.
5. Confirmar que el cron sigue andando: revisar
   `select * from cron.job_run_details order by start_time desc limit
   5;` después de la próxima corrida horaria — sin errores nuevos de
   permiso.
6. En la app (usuario real, navegador): login normal, dashboard carga
   permisos (`usePermissions`), selector de vendedor en `/leads`
   sigue mostrando la lista — confirma que el re-grant a
   `authenticated` no rompió nada visible.
7. Confirmar que `mover_lead_estado`/`mover_ticket_estado` ya no
   existen (`select proname from pg_proc where proname in
   ('mover_lead_estado','mover_ticket_estado');` → 0 filas) y que la
   app sigue moviendo leads/tickets de estado con normalidad (Kanban
   drag & drop) — confirma que en efecto no las usaba.
