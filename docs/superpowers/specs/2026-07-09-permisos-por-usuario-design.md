# Overrides de permisos por usuario + widgets acoplados a permisos

## Contexto

La dueña reportó que al quitar el widget "Clientes totales" en `/admin/dashboards`
seguía viendo la página `/clientes`. Investigación (ver conversación) confirmó que
no era un bug: son dos sistemas independientes.

- `dashboard_widgets`/`user_dashboard_widgets` controla qué tarjetas KPI/gráfico
  aparecen en el dashboard personal (`/`).
- El acceso a páginas completas (Clientes, Leads, Tickets, Reportes) se controla
  por el RBAC normal (`roles` → `role_permissions` → `permissions`), con
  `user_permission_overrides` como mecanismo de excepción individual ya modelado
  en el schema pero **sin pantalla de administración** — solo editable a mano
  por SQL.

Esto llevó a clarificar el pedido real: la dueña quiere poder quitarle
funcionalidades completas (páginas) a usuarios específicos (ej. Tickets a quien
no hace servicio técnico) desde una UI, y que el dashboard personal de cada
usuario solo ofrezca/muestre widgets de páginas a las que ese usuario
efectivamente tiene acceso.

## Parte A — Pantalla de overrides de permisos (`/admin/permisos`)

**Acceso:** gateado por `has_permission(auth.uid(), 'dashboard_widgets', 'assign')`
— mismo permiso que ya usa `/admin/dashboards`. Hoy solo lo tiene el rol `dueña`.

**Alcance:** los 24 `resource`+`action` existentes en `permissions` (no solo
view/view_all) — cualquier ajuste fino futuro (create/edit/delete/assign) queda
cubierto sin volver a tocar código.

**Salvaguarda:** el selector de usuario **excluye al usuario logueado**. Nadie
puede editar sus propios permisos desde esta pantalla — elimina el riesgo de
que la dueña se revoque `dashboard_widgets.assign` a sí misma y quede sin
acceso a las pantallas de administración (no hay UI para deshacer eso, solo SQL).

**Modelo de datos** (tabla ya existe desde la migración inicial, falta exponerla):

```
user_permission_overrides(user_id, permission_id, effect: grant|revoke, created_by)
```

Sin fila = hereda del rol. Con fila `grant` = forzado a Sí. Con fila `revoke` =
forzado a No.

**Hallazgo técnico:** `permissions`, `role_permissions` y `user_permission_overrides`
tienen RLS activado pero **cero políticas** — hoy son inaccesibles desde el
cliente por diseño (solo se leen vía RPCs `security definer` como
`has_permission`/`permisos_efectivos_usuario`). Se necesita una migración nueva
que agregue políticas de lectura/escritura gateadas por el mismo permiso de
acceso a la pantalla, replicando el patrón que ya usa `dashboard_widgets`.

### Migración `20260709000000_rls_permisos_admin.sql`

```sql
alter table permissions enable row level security; -- ya está enabled, solo faltan políticas
create policy permissions_select on permissions
for select using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));

create policy role_permissions_select on role_permissions
for select using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));

create policy user_permission_overrides_select on user_permission_overrides
for select using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));

create policy user_permission_overrides_write on user_permission_overrides
for all using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));
```

(Sintaxis final se ajusta durante implementación; `alter table ... enable row
level security` es no-op si ya está activado, se incluye por completitud/idempotencia
documental.)

### Composable `app/composables/usePermisosOverrides.ts`

- `fetchCatalogoPermisos()` — todas las filas de `permissions`.
- `fetchHeredadosDeRol(roleId)` — filas de `role_permissions` para ese rol
  (para mostrar "rol: sí/no" junto al botón Heredado).
- `fetchOverridesDeUsuario(userId)` — filas de `user_permission_overrides` para
  ese usuario.
- `setOverride(userId, permissionId, effect: 'grant'|'revoke')` — upsert.
- `quitarOverride(userId, permissionId)` — delete (vuelve a "Heredado").

`useUsuarios.fetchUsuarios()` se extiende para incluir `role_id` (hoy solo trae
`role:roles(name)`), necesario para resolver `fetchHeredadosDeRol`.

### Página `app/pages/admin/permisos/index.vue`

Mismo layout que `/admin/dashboards`: selector de usuario (sin la opción de
elegirse a sí mismo) → lista de permisos agrupada por `resource` (8 grupos) →
por cada `action`, 3 botones: **Heredado** / **Otorgar** / **Revocar**, con el
estado del rol entre paréntesis junto a "Heredado". Errores con
`useToast().error()`, mismo patrón que el resto del admin.

### Sidebar (`app/layouts/default.vue`)

Nuevo `NuxtLink` "Permisos" en la sección "Administración", junto a
"Dashboards"/"Auditoría", mismo gate (`can('dashboard_widgets','assign')`).

## Parte B — Acoplar el catálogo de widgets a los permisos del usuario

**Problema:** hoy se puede asignar el widget "Tickets abiertos" a un usuario
aunque no tenga permiso para ver la página Tickets — sistemas totalmente
desacoplados.

**Decisión:** doble filtro — al asignar (catálogo) y al renderizar (dashboard
propio), para cubrir tanto la asignación futura como una revocación de permiso
posterior a un usuario que ya tenía el widget asignado.

### Migración `20260709000100_dashboard_widgets_resource.sql`

```sql
alter table dashboard_widgets add column resource text not null default 'clientes';
-- backfill explícito por key, luego se puede quitar el default si se desea
update dashboard_widgets set resource = 'leads'    where key = 'kpi.leads_activos';
update dashboard_widgets set resource = 'tickets'  where key = 'kpi.tickets_abiertos';
update dashboard_widgets set resource = 'clientes' where key = 'kpi.clientes_totales';
update dashboard_widgets set resource = 'leads'    where key = 'chart.leads_por_estado';
update dashboard_widgets set resource = 'leads'    where key = 'kpi.tasa_conversion';
```

(Mapeo confirmado leyendo cada componente: `KpiTasaConversion.vue` usa
`useLeads().fetchLeads()`, por eso `resource = 'leads'`.)

### Filtro al asignar (`/admin/dashboards`)

Al seleccionar un usuario, se llama `supabase.rpc('permisos_efectivos_usuario', { p_user: userId })`
(RPC que ya existe y ya resuelve overrides) y el catálogo mostrado se filtra a
solo los widgets cuyo `resource` tenga `view` o `view_all` en el resultado.
Si el usuario no tiene acceso a Tickets, "Tickets abiertos" no aparece como
opción para asignarle.

### Filtro al renderizar (`app/pages/index.vue`)

Cada widget en `misWidgets` se filtra adicionalmente por
`can(w.resource, 'view') || can(w.resource, 'view_all')` usando
`usePermissions()` — que ya está cargado por el usuario logueado, sin llamada
extra al servidor.

`mis_widgets()` se actualiza (`create or replace`, misma migración de la
Parte B) para incluir `resource` en su `returns table`:

```sql
create or replace function mis_widgets()
returns table (key text, label text, component text, resource text, tipo text, orden int, config jsonb)
language sql
security definer
stable
as $$
  select w.key, w.label, w.component, w.resource, w.tipo, udw.orden, udw.config
  from user_dashboard_widgets udw
  join dashboard_widgets w on w.id = udw.widget_id
  where udw.user_id = auth.uid()
  order by udw.orden;
$$;
```

`MiWidget` (interfaz en `useDashboardWidgets.ts`) gana el campo `resource: string`.

## Testing (manual, sin suite automatizada aún)

1. Login como dueña → `/admin/permisos` → seleccionar un usuario de prueba →
   revocar `tickets.view` y `tickets.view_all` → confirmar que el link
   "Tickets" desaparece del sidebar de ese usuario y `/tickets` redirige/bloquea.
2. Confirmar que el selector de usuario en `/admin/permisos` NO ofrece la
   cuenta actualmente logueada.
3. En `/admin/dashboards`, con ese mismo usuario de prueba (sin acceso a
   Tickets), confirmar que "Tickets abiertos" no aparece en el catálogo
   asignable.
4. Asignar "Tickets abiertos" a un usuario CON acceso a tickets, luego
   revocarle el acceso a Tickets desde `/admin/permisos`, y confirmar que el
   widget desaparece de su dashboard (`/`) en el siguiente render.

## Fuera de alcance

- No se toca la página `/reportes` (permisos propios, independiente).
- No se agregan widgets nuevos.
- No se resuelve el caso de dos administradores bloqueándose mutuamente el
  acceso (hoy solo existe un usuario con rol `dueña`).
