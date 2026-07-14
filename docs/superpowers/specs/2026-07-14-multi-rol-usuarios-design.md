# Multi-rol de usuarios — diseño

Fecha: 2026-07-14

## Contexto

Hoy `profiles.role_id` es una FK simple a `roles`: cada usuario tiene exactamente
un rol, y `has_permission()` / `permisos_efectivos_usuario()` resuelven permisos
a partir de ese único rol. El negocio necesita que un usuario pueda tener
varios roles a la vez (ej: alguien que es "ventas" y "soporte").

La asignación de rol hoy se hace fuera de la app (SQL directo — ver comentario
en `useUsuarios.ts`). No existe pantalla `/admin/usuarios`.

## Alcance

Dentro:
- Modelo de datos many-to-many usuario↔rol.
- `has_permission()` y `permisos_efectivos_usuario()` adaptados (unión de permisos
  de todos los roles asignados).
- Nueva pantalla `/admin/usuarios` para asignar/quitar roles a un usuario.
- Actualizar composables y componentes que leen el rol de un usuario
  (`useMiPerfil`, `useUsuarios`, `PerfilModal`, `UserMenu`).
- Fix de un bug preexistente: la tabla `roles` tiene RLS activo sin ninguna
  política de SELECT, por lo que el nombre del rol nunca se leía correctamente
  vía el join `role:roles(name)`.

Fuera:
- Jerarquías de roles, roles compuestos, herencia entre roles.
- Cambios a `user_permission_overrides` (sigue funcionando igual, por encima
  de los roles).
- UI para crear/editar/borrar roles o permisos del catálogo (sigue siendo
  SQL directo).

## Modelo de datos

Nueva tabla:

```sql
create table profile_roles (
  profile_id uuid not null references profiles(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, role_id)
);
```

Migración de datos: una fila en `profile_roles` por cada `profiles.role_id`
no nulo existente.

Se elimina `profiles.role_id` tras migrar los datos — evita mantener dos
fuentes de verdad para el mismo dato.

## Resolución de permisos

`has_permission(p_user, p_resource, p_action)` y `permisos_efectivos_usuario(p_user)`
cambian su join de `profiles pr ... pr.role_id` a
`profiles pr join profile_roles pfr on pfr.profile_id = pr.id join role_permissions rp on rp.role_id = pfr.role_id`.

Semántica: un usuario tiene un permiso si **cualquiera** de sus roles asignados
lo otorga (unión). Los overrides individuales (`user_permission_overrides`)
siguen aplicándose por encima de esta resolución, exactamente igual que hoy
(un `revoke` gana sobre cualquier rol; un `grant` otorga aunque ningún rol lo dé).

## RLS

- `roles`: se agrega `roles_select` — `for select using (auth.role() = 'authenticated')`.
  Fix del bug preexistente: sin esta política, cualquier join a `roles` desde
  el cliente devuelve null silenciosamente en vez de error.
- `profile_roles`:
  - `profile_roles_select`: `profile_id = auth.uid() or has_permission(auth.uid(), 'dashboard_widgets', 'assign')`
    (un usuario puede ver sus propios roles asignados; un admin ve los de cualquiera).
  - `profile_roles_write`: `for all using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'))`
    (mismo permiso que ya gatea `/admin/permisos`).
- Trigger de `profiles` (`20260702000900_rls_profiles.sql`) que bloquea cambiar
  `role_id`/`active` desde el cliente: se actualiza para dejar de referenciar
  `role_id` (ya no existe en la tabla) y seguir bloqueando `active`.

## Composables y tipos

**`useMiPerfil.ts`**
- `MiPerfil.role: string | null` → `MiPerfil.roles: string[]` (nombres de rol,
  ordenados alfabéticamente).
- `SELECT_PERFIL` cambia el embed `role:roles(name)` por
  `profile_roles(role:roles(name))`, y `mapearPerfil` aplana esa estructura
  a `roles: string[]`.

**`useUsuarios.ts`**
- `Usuario.role_id` / `Usuario.role` → `Usuario.roles: { id: string; name: string }[]`.
- `fetchUsuarios` cambia el select para embeber `profile_roles(role:roles(id,name))`.
- `fetchUsuariosPorRol(roleName)` (hoy sin consumidores) se adapta a filtrar
  por `usuario.roles.some(r => r.name === roleName)` — se mantiene funcional
  pero no se agrega ningún caller nuevo.

**Nuevo `useRolesUsuario.ts`**
```ts
fetchCatalogoRoles(): Promise<{ id: string; name: string }[]>
asignarRol(userId: string, roleId: string): Promise<void>
quitarRol(userId: string, roleId: string): Promise<void>
```

**`PerfilModal.vue`** y **`UserMenu.vue`**: reemplazan el badge/texto de rol
único por la lista de `perfil.roles` (varios badges en `PerfilModal`, texto
unido por ", " en el subtítulo de `UserMenu`).

## UI: `/admin/usuarios`

Nueva página, mismo patrón que `/admin/permisos` (`app/pages/admin/permisos/index.vue`):

- Gate: `permiso: { resource: 'dashboard_widgets', actions: ['assign'] }`.
- Selector de usuario (excluye al usuario actual — mismo guard anti-autobloqueo
  que ya existe en `/admin/permisos`, por si el único rol con `dashboard_widgets.assign`
  fuera el propio).
- Lista de checkboxes, uno por rol del catálogo. Tildar/destildar llama a
  `asignarRol`/`quitarRol` de inmediato (igual patrón optimista que
  `aplicarEstado` en `/admin/permisos`), sin botón "Guardar" separado.

## Migración SQL (una sola)

Orden dentro de la migración:
1. Crear `profile_roles` + índices.
2. Copiar datos desde `profiles.role_id` (where not null).
3. Reemplazar `has_permission()` y `permisos_efectivos_usuario()`.
4. Agregar `roles_select`, `profile_roles_select`, `profile_roles_write`.
5. Actualizar el trigger de `profiles` (quitar referencia a `role_id`).
6. `alter table profiles drop column role_id`.

## Testing / verificación

- `npm run build` sin errores de tipos rotos por el cambio de `role`→`roles`.
- SQL directo: verificar que `has_permission` devuelve `true` para un usuario
  con dos roles donde solo uno de ellos otorga el permiso probado.
- Verificación manual en navegador: asignar un segundo rol a un usuario desde
  `/admin/usuarios`. `usePermissions()` cachea los permisos efectivos en
  `useState` una sola vez por sesión (`cargarPermisos`), así que el usuario
  afectado necesita recargar sesión (relogin o refresh que dispare
  `cargarPermisos` de nuevo) para ver el permiso nuevo aplicado — comportamiento
  ya existente, no una regresión de este cambio.
- Confirmar que `UserMenu`/`PerfilModal` muestran los roles correctos tras el
  fix de `roles_select`.
