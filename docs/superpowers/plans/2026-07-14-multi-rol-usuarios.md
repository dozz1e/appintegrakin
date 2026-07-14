# Multi-rol de usuarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un usuario tenga varios roles a la vez (hoy `profiles.role_id` es 1:1), con una pantalla admin para asignarlos.

**Architecture:** Nueva tabla `profile_roles` (many-to-many usuario↔rol) reemplaza `profiles.role_id`. `has_permission()` y `permisos_efectivos_usuario()` resuelven por unión de permisos de todos los roles asignados. Nueva pantalla `/admin/usuarios` gateada por el mismo permiso que `/admin/permisos` (`dashboard_widgets.assign`).

**Tech Stack:** Nuxt 3 / Vue 3 `<script setup>`, Supabase (Postgres + RLS), Tailwind.

## Global Constraints

- No hay framework de tests en el proyecto — verificación es `npm run build` (compila, NO type-checkea templates Vue) + SQL directo vía MCP + verificación manual en navegador.
- Componentes en `app/components/shared/X.vue` se auto-importan como `<SharedX>`.
- Todo texto de UI en español neutro (sin voseo).
- Migraciones SQL se aplican con `mcp__supabase__apply_migration`.
- Sigue el patrón existente de `/admin/permisos` para la nueva pantalla `/admin/usuarios` (mismo gate de permiso, mismo guard anti-autobloqueo, mismo patrón de toggle optimista sin botón "Guardar").

---

### Task 1: Migración SQL — tabla profile_roles + funciones + RLS + drop role_id

**Files:**
- Create: `supabase/migrations/20260714000000_multi_rol_usuarios.sql`

**Interfaces:**
- Produces: tabla `profile_roles(profile_id uuid, role_id uuid, created_at timestamptz)` PK compuesta; funciones `has_permission(p_user, p_resource, p_action)` y `permisos_efectivos_usuario(p_user)` actualizadas para leer de `profile_roles`; políticas `roles_select`, `profile_roles_select`, `profile_roles_write`; columna `profiles.role_id` eliminada.

- [ ] **Step 1: Aplicar la migración**

Contenido completo del archivo:

```sql
-- supabase/migrations/20260714000000_multi_rol_usuarios.sql
--
-- Multi-rol de usuarios: profiles.role_id (uno a uno) -> profile_roles
-- (muchos a muchos). Ver docs/superpowers/specs/2026-07-14-multi-rol-usuarios-design.md

create table profile_roles (
  profile_id uuid not null references profiles(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, role_id)
);

create index idx_profile_roles_role on profile_roles(role_id);

alter table profile_roles enable row level security;

-- Migrar datos existentes antes de tocar has_permission/permisos_efectivos_usuario.
insert into profile_roles (profile_id, role_id)
select id, role_id from profiles where role_id is not null;

-- Resolución de permisos: unión de permisos de TODOS los roles asignados.
create or replace function has_permission(p_user uuid, p_resource text, p_action text)
returns boolean
language plpgsql
stable
security definer
as $$
declare
  v_override text;
  v_role_has boolean;
begin
  if exists (select 1 from superadmins where user_id = p_user) then
    return true;
  end if;

  select upo.effect into v_override
  from user_permission_overrides upo
  join permissions p on p.id = upo.permission_id
  where upo.user_id = p_user and p.resource = p_resource and p.action = p_action;

  if v_override = 'revoke' then
    return false;
  elsif v_override = 'grant' then
    return true;
  end if;

  select exists (
    select 1
    from profile_roles pfr
    join role_permissions rp on rp.role_id = pfr.role_id
    join permissions p on p.id = rp.permission_id
    where pfr.profile_id = p_user and p.resource = p_resource and p.action = p_action
  ) into v_role_has;

  return coalesce(v_role_has, false);
end;
$$;

create or replace function permisos_efectivos_usuario(p_user uuid)
returns table(resource text, action text)
language sql
stable
security definer
as $$
  with base as (
    select p.resource, p.action
    from profile_roles pfr
    join role_permissions rp on rp.role_id = pfr.role_id
    join permissions p on p.id = rp.permission_id
    where pfr.profile_id = p_user
  ),
  overrides_grant as (
    select p.resource, p.action
    from user_permission_overrides upo
    join permissions p on p.id = upo.permission_id
    where upo.user_id = p_user and upo.effect = 'grant'
  ),
  overrides_revoke as (
    select p.resource, p.action
    from user_permission_overrides upo
    join permissions p on p.id = upo.permission_id
    where upo.user_id = p_user and upo.effect = 'revoke'
  )
  select resource, action from base
  union
  select resource, action from overrides_grant
  except
  select resource, action from overrides_revoke;
$$;

-- Fix de bug preexistente: roles tenía RLS activo sin ninguna política de
-- SELECT, así que cualquier join a roles desde el cliente devolvía null
-- silenciosamente en vez de error (ver spec, sección RLS).
create policy roles_select on roles
for select using (auth.role() = 'authenticated');

create policy profile_roles_select on profile_roles
for select using (
  profile_id = auth.uid()
  or has_permission(auth.uid(), 'dashboard_widgets', 'assign')
);

create policy profile_roles_write on profile_roles
for all using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));

-- El trigger ya no protege role_id (la columna se elimina más abajo), solo active.
create or replace function proteger_cambio_rol()
returns trigger
language plpgsql
security definer
as $$
begin
  if (new.active is distinct from old.active) and auth.uid() is not null then
    raise exception 'Solo un administrador puede cambiar el estado activo de un usuario';
  end if;
  return new;
end;
$$;

alter table profiles drop column role_id;
```

Usar `mcp__supabase__apply_migration` con `name: "multi_rol_usuarios"` y el SQL de arriba.

- [ ] **Step 2: Verificar la migración**

Ejecutar vía `mcp__supabase__execute_sql`:

```sql
select count(*) from profile_roles;
select column_name from information_schema.columns where table_name = 'profiles' and column_name = 'role_id';
```

Esperado: `profile_roles` tiene al menos una fila por cada perfil que antes tenía `role_id` no nulo; la segunda query no devuelve filas (columna eliminada).

- [ ] **Step 3: Verificar resolución de permisos con dos roles**

```sql
-- Tomar un usuario cualquiera con al menos un rol y un permiso que NO tenga hoy,
-- asignarle un segundo rol que sí otorgue ese permiso, y confirmar el resultado.
select pr.id, pr.full_name, array_agg(r.name) as roles
from profiles pr
join profile_roles pfr on pfr.profile_id = pr.id
join roles r on r.id = pfr.role_id
group by pr.id, pr.full_name
limit 5;
```

Confirmar que la query corre sin error y devuelve los roles esperados para al menos un usuario conocido.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260714000000_multi_rol_usuarios.sql
git commit -m "feat: migrar profiles.role_id a tabla many-to-many profile_roles"
```

---

### Task 2: Extender useMiPerfil.ts a multi-rol

**Files:**
- Modify: `app/composables/useMiPerfil.ts` (rewrite completo)

**Interfaces:**
- Consumes: tabla `profile_roles` de Task 1.
- Produces: `MiPerfil.roles: string[]` (reemplaza `MiPerfil.role: string | null`). Consumido por Task 5 (`PerfilModal.vue`) y Task 6 (`UserMenu.vue`).

- [ ] **Step 1: Reescribir el archivo completo**

```ts
// composables/useMiPerfil.ts
// Reemplaza intencionalmente al usePerfilActual.ts huérfano que borramos -
// mismo propósito, pero con el guard correcto y usando .sub (no .id).

export interface MiPerfil {
  id: string
  full_name: string | null
  email: string | null
  roles: string[]
  avatar_url: string | null
  settings: Record<string, unknown>
}

type FilaPerfil = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  settings: Record<string, unknown> | null
  profile_roles: { role: { name: string } | null }[] | null
}

function mapearPerfil(data: FilaPerfil): MiPerfil {
  const roles = (data.profile_roles ?? [])
    .map((pr) => pr.role?.name)
    .filter((n): n is string => !!n)
    .sort()
  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    avatar_url: data.avatar_url,
    settings: data.settings ?? {},
    roles,
  }
}

const SELECT_PERFIL = 'id, full_name, email, avatar_url, settings, profile_roles(role:roles(name))'

export const useMiPerfil = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const perfil = useState<MiPerfil | null>('mi-perfil', () => null)

  const cargarMiPerfil = async () => {
    if (!user.value?.sub) {
      perfil.value = null
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select(SELECT_PERFIL)
      .eq('id', user.value.sub)
      .single()

    if (error) {
      console.error('Error cargando mi perfil', error)
      return
    }
    perfil.value = mapearPerfil(data as unknown as FilaPerfil)
  }

  const actualizarMiPerfil = async (payload: { full_name?: string; avatar_url?: string }) => {
    if (!user.value?.sub) throw new Error('No hay sesión activa')
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.value.sub)
      .select(SELECT_PERFIL)
      .single()

    if (error) throw error
    perfil.value = mapearPerfil(data as unknown as FilaPerfil)
  }

  const actualizarConfiguracion = async (patch: Record<string, unknown>) => {
    if (!user.value?.sub) throw new Error('No hay sesión activa')
    const nuevoSettings = { ...(perfil.value?.settings ?? {}), ...patch }
    const { data, error } = await supabase
      .from('profiles')
      .update({ settings: nuevoSettings })
      .eq('id', user.value.sub)
      .select(SELECT_PERFIL)
      .single()

    if (error) throw error
    perfil.value = mapearPerfil(data as unknown as FilaPerfil)
  }

  const subirFotoPerfil = async (archivo: File): Promise<string> => {
    if (!user.value?.sub) throw new Error('No hay sesión activa')
    const path = `${user.value.sub}/${Date.now()}-${archivo.name}`
    const { error } = await supabase.storage.from('perfiles-imagenes').upload(path, archivo)
    if (error) throw error

    const { data } = supabase.storage.from('perfiles-imagenes').getPublicUrl(path)
    return data.publicUrl
  }

  return { perfil, cargarMiPerfil, actualizarMiPerfil, actualizarConfiguracion, subirFotoPerfil }
}
```

Nota: `actualizarMiPerfil`/`actualizarConfiguracion` pasan de `return` silencioso a `throw` cuando no hay sesión — alinea con `subirFotoPerfil` y corrige un hallazgo "Important" pendiente de la revisión de la feature anterior (toast de éxito falso si el JWT expira a mitad de edición).

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build completo sin errores de compilación.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useMiPerfil.ts
git commit -m "feat: useMiPerfil soporta multi-rol y falla explícito si no hay sesión"
```

---

### Task 3: Extender useUsuarios.ts a multi-rol

**Files:**
- Modify: `app/composables/useUsuarios.ts` (rewrite completo)

**Interfaces:**
- Consumes: tabla `profile_roles` de Task 1.
- Produces: `Usuario { id, full_name, email, roles: {id: string; name: string}[] }` (reemplaza `role_id`/`role`). Consumido por Task 4 (`admin/permisos`) y Task 8 (`admin/usuarios`).

- [ ] **Step 1: Reescribir el archivo completo**

```ts
// composables/useUsuarios.ts
// Lectura de profiles - usado para selectores de "asignar a" en leads/tickets,
// y para las pantallas de administración de dashboards/permisos/usuarios.
// No incluye create/delete: eso se maneja fuera del cliente (ver migración
// 20260702000900_rls_profiles.sql). La asignación de ROLES sí se hace desde
// /admin/usuarios (ver useRolesUsuario.ts).

export interface Usuario {
  id: string
  full_name: string | null
  email: string | null
  roles: { id: string; name: string }[]
}

type FilaUsuario = {
  id: string
  full_name: string | null
  email: string | null
  profile_roles: { role: { id: string; name: string } | null }[] | null
}

function mapearUsuario(data: FilaUsuario): Usuario {
  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    roles: (data.profile_roles ?? [])
      .map((pr) => pr.role)
      .filter((r): r is { id: string; name: string } => !!r),
  }
}

export const useUsuarios = () => {
  const supabase = useSupabaseClient()

  const fetchUsuarios = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, profile_roles(role:roles(id,name))')
      .eq('active', true)
      .order('full_name')
    if (error) throw error
    return (data as unknown as FilaUsuario[]).map(mapearUsuario)
  }

  const fetchUsuariosPorRol = async (roleName: string) => {
    const todos = await fetchUsuarios()
    return todos.filter((u) => u.roles.some((r) => r.name === roleName))
  }

  return { fetchUsuarios, fetchUsuariosPorRol }
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: falla en `app/pages/admin/permisos/index.vue` (usa `usuario.role_id`, eliminado) — esperado, se corrige en Task 4. Confirmar que el único error nuevo es ese.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useUsuarios.ts
git commit -m "feat: useUsuarios expone roles múltiples en vez de role_id/role único"
```

---

### Task 4: Adaptar /admin/permisos a roles múltiples

**Files:**
- Modify: `app/composables/usePermisosOverrides.ts:30-37`
- Modify: `app/pages/admin/permisos/index.vue:11,46-48`

**Interfaces:**
- Consumes: `Usuario.roles: {id,name}[]` de Task 3.
- Produces: `fetchHeredadosDeRoles(roleIds: string[]): Promise<Set<string>>` (reemplaza `fetchHeredadosDeRol(roleId: string)`).

- [ ] **Step 1: Renombrar y adaptar fetchHeredadosDeRol a múltiples roles**

En `app/composables/usePermisosOverrides.ts`, reemplazar:

```ts
  const fetchHeredadosDeRol = async (roleId: string) => {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', roleId)
    if (error) throw error
    return new Set((data ?? []).map((r) => r.permission_id as string))
  }
```

por:

```ts
  const fetchHeredadosDeRoles = async (roleIds: string[]) => {
    if (roleIds.length === 0) return new Set<string>()
    const { data, error } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .in('role_id', roleIds)
    if (error) throw error
    return new Set((data ?? []).map((r) => r.permission_id as string))
  }
```

Y en el `return` del composable (línea ~76-83), cambiar `fetchHeredadosDeRol` por `fetchHeredadosDeRoles`.

- [ ] **Step 2: Actualizar el callsite en admin/permisos/index.vue**

Línea 11, cambiar:

```ts
const { fetchCatalogoPermisos, fetchHeredadosDeRol, fetchOverridesDeUsuario, setOverride, quitarOverride } =
  usePermisosOverrides()
```

por:

```ts
const { fetchCatalogoPermisos, fetchHeredadosDeRoles, fetchOverridesDeUsuario, setOverride, quitarOverride } =
  usePermisosOverrides()
```

Líneas 45-48, cambiar:

```ts
  const usuario = usuarios.value.find((u) => u.id === userId)
  if (usuario?.role_id) {
    heredados.value = await fetchHeredadosDeRol(usuario.role_id)
  }
```

por:

```ts
  const usuario = usuarios.value.find((u) => u.id === userId)
  if (usuario?.roles.length) {
    heredados.value = await fetchHeredadosDeRoles(usuario.roles.map((r) => r.id))
  }
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build completo sin errores de compilación (el error de Task 3 Step 2 desaparece).

- [ ] **Step 4: Commit**

```bash
git add app/composables/usePermisosOverrides.ts app/pages/admin/permisos/index.vue
git commit -m "fix: /admin/permisos resuelve permisos heredados sobre múltiples roles"
```

---

### Task 5: Mostrar múltiples roles en PerfilModal.vue

**Files:**
- Modify: `app/components/shared/PerfilModal.vue:83-86`

**Interfaces:**
- Consumes: `MiPerfil.roles: string[]` de Task 2.

- [ ] **Step 1: Reemplazar el bloque de rol único por lista de badges**

Reemplazar:

```vue
      <div>
        <label class="block text-xs font-medium text-ink-muted mb-1">Rol</label>
        <SharedBadge :label="perfil?.role ?? '—'" clases="bg-neutral-bg text-neutral-text" />
      </div>
```

por:

```vue
      <div>
        <label class="block text-xs font-medium text-ink-muted mb-1">Roles</label>
        <div v-if="perfil?.roles?.length" class="flex flex-wrap gap-1.5">
          <SharedBadge
            v-for="rol in perfil.roles"
            :key="rol"
            :label="rol"
            clases="bg-neutral-bg text-neutral-text"
          />
        </div>
        <SharedBadge v-else label="—" clases="bg-neutral-bg text-neutral-text" />
      </div>
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build completo sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/PerfilModal.vue
git commit -m "feat: PerfilModal muestra todos los roles asignados, no solo uno"
```

---

### Task 6: Mostrar múltiples roles en UserMenu.vue

**Files:**
- Modify: `app/components/shared/UserMenu.vue:48`

**Interfaces:**
- Consumes: `MiPerfil.roles: string[]` de Task 2.

- [ ] **Step 1: Cambiar el subtítulo de rol único a lista unida por coma**

Reemplazar:

```vue
        <p class="text-xs text-ink-muted leading-tight capitalize">{{ perfil?.role || '' }}</p>
```

por:

```vue
        <p class="text-xs text-ink-muted leading-tight capitalize">{{ perfil?.roles?.join(', ') || '' }}</p>
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build completo sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/UserMenu.vue
git commit -m "feat: UserMenu muestra todos los roles asignados en el subtítulo"
```

---

### Task 7: Crear useRolesUsuario.ts

**Files:**
- Create: `app/composables/useRolesUsuario.ts`

**Interfaces:**
- Consumes: tabla `profile_roles` y `roles` de Task 1 (RLS ya permite lectura/escritura según permiso `dashboard_widgets.assign`).
- Produces: `fetchCatalogoRoles(): Promise<RolCatalogo[]>`, `asignarRol(userId: string, roleId: string): Promise<void>`, `quitarRol(userId: string, roleId: string): Promise<void>`. Consumido por Task 8.

- [ ] **Step 1: Crear el composable**

```ts
// composables/useRolesUsuario.ts
// Asignación de roles a usuarios (multi-rol) - usado desde /admin/usuarios.
// Gateado por RLS: solo quien tiene dashboard_widgets.assign puede escribir
// en profile_roles (ver 20260714000000_multi_rol_usuarios.sql).

export interface RolCatalogo {
  id: string
  name: string
}

export const useRolesUsuario = () => {
  const supabase = useSupabaseClient()

  const fetchCatalogoRoles = async (): Promise<RolCatalogo[]> => {
    const { data, error } = await supabase.from('roles').select('id, name').order('name')
    if (error) throw error
    return data as RolCatalogo[]
  }

  const asignarRol = async (userId: string, roleId: string): Promise<void> => {
    const { error } = await supabase.from('profile_roles').insert({ profile_id: userId, role_id: roleId })
    if (error) throw error
  }

  const quitarRol = async (userId: string, roleId: string): Promise<void> => {
    const { error } = await supabase
      .from('profile_roles')
      .delete()
      .eq('profile_id', userId)
      .eq('role_id', roleId)
    if (error) throw error
  }

  return { fetchCatalogoRoles, asignarRol, quitarRol }
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build completo sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useRolesUsuario.ts
git commit -m "feat: agregar useRolesUsuario para asignar/quitar roles"
```

---

### Task 8: Crear página /admin/usuarios

**Files:**
- Create: `app/pages/admin/usuarios/index.vue`
- Modify: `app/layouts/default.vue:54-67`

**Interfaces:**
- Consumes: `useUsuarios().fetchUsuarios` (Task 3), `useRolesUsuario()` (Task 7).

- [ ] **Step 1: Crear la página**

```vue
<!-- app/pages/admin/usuarios/index.vue -->
<script setup lang="ts">
import type { Usuario } from '~/composables/useUsuarios'
import type { RolCatalogo } from '~/composables/useRolesUsuario'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'dashboard_widgets', actions: ['assign'] },
})

const { fetchUsuarios } = useUsuarios()
const { fetchCatalogoRoles, asignarRol, quitarRol } = useRolesUsuario()
const { success, error } = useToast()
const usuarioActual = useSupabaseUser()

const catalogoRoles = ref<RolCatalogo[]>([])
const usuarios = ref<Usuario[]>([])
const usuarioSeleccionado = ref('')
const rolesDelUsuario = ref<Set<string>>(new Set()) // role_id
const cargando = ref(true)
const aplicando = ref<string | null>(null) // role_id en curso, para deshabilitar su checkbox

// Mismo guard que /admin/permisos: nadie edita sus propios roles desde acá,
// evita que la dueña se quite a sí misma el único rol con dashboard_widgets.assign.
const usuariosSeleccionables = computed(() => usuarios.value.filter((u) => u.id !== usuarioActual.value?.sub))

onMounted(async () => {
  catalogoRoles.value = await fetchCatalogoRoles()
  usuarios.value = await fetchUsuarios()
  cargando.value = false
})

const seleccionarUsuario = (userId: string) => {
  usuarioSeleccionado.value = userId
  const usuario = usuarios.value.find((u) => u.id === userId)
  rolesDelUsuario.value = new Set((usuario?.roles ?? []).map((r) => r.id))
}

const tieneRol = (roleId: string): boolean => rolesDelUsuario.value.has(roleId)

const alternarRol = async (roleId: string) => {
  if (!usuarioSeleccionado.value) return
  aplicando.value = roleId
  try {
    if (tieneRol(roleId)) {
      await quitarRol(usuarioSeleccionado.value, roleId)
      rolesDelUsuario.value.delete(roleId)
    } else {
      await asignarRol(usuarioSeleccionado.value, roleId)
      rolesDelUsuario.value.add(roleId)
    }
    rolesDelUsuario.value = new Set(rolesDelUsuario.value)
    success('Roles actualizados')
  } catch (e) {
    error('No se pudo actualizar el rol')
  } finally {
    aplicando.value = null
  }
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <h1 class="text-lg font-semibold mb-2">Roles por usuario</h1>
    <p class="text-sm text-gray-400 mb-6">
      Un usuario puede tener varios roles a la vez. Sus permisos son la unión de los permisos de todos sus roles
      asignados, más los overrides puntuales de /admin/permisos.
    </p>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>

    <template v-else>
      <select
        :value="usuarioSeleccionado"
        class="w-full border rounded px-2 py-1.5 text-sm mb-6"
        @change="seleccionarUsuario(($event.target as HTMLSelectElement).value)"
      >
        <option value="">Selecciona un usuario</option>
        <option v-for="u in usuariosSeleccionables" :key="u.id" :value="u.id">{{ u.full_name || u.email }}</option>
      </select>

      <ul v-if="usuarioSeleccionado" class="space-y-1">
        <li
          v-for="rol in catalogoRoles"
          :key="rol.id"
          class="flex items-center justify-between text-sm border rounded px-3 py-2"
        >
          <span class="font-medium">{{ rol.name }}</span>
          <input
            type="checkbox"
            :checked="tieneRol(rol.id)"
            :disabled="aplicando === rol.id"
            @change="alternarRol(rol.id)"
          />
        </li>
      </ul>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Agregar el link de navegación**

En `app/layouts/default.vue`, dentro del bloque `<div v-if="can('dashboard_widgets', 'assign') || can('auditoria', 'view_all')">` (línea 54), agregar junto a los otros `SharedNavLink` de administración (después del de "Permisos", línea 62):

```vue
            <SharedNavLink v-if="can('dashboard_widgets', 'assign')" to="/admin/usuarios" :activo="esActivo('/admin/usuarios')">
              Usuarios
            </SharedNavLink>
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build completo sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/pages/admin/usuarios/index.vue app/layouts/default.vue
git commit -m "feat: agregar pantalla /admin/usuarios para asignar roles múltiples"
```

---

### Task 9: Verificación manual end-to-end

**Files:** Ninguno (solo verificación).

- [ ] **Step 1: Build final**

Run: `npm run build`
Expected: `✨ Build complete!` sin errores.

- [ ] **Step 2: Verificación SQL de permisos con dos roles**

Vía `mcp__supabase__execute_sql`, elegir un usuario de prueba, asignarle un segundo rol directamente y confirmar que `has_permission` refleja la unión:

```sql
-- Ejemplo: ver roles y permisos efectivos de un usuario conocido
select * from permisos_efectivos_usuario('<uuid-usuario-de-prueba>');
```

Confirmar que la lista incluye permisos de todos sus roles asignados en `profile_roles`.

- [ ] **Step 3: Verificación en navegador**

Con sesión autenticada como usuario con `dashboard_widgets.assign`:
1. Ir a `/admin/usuarios`, seleccionar un usuario, tildar un segundo rol → toast "Roles actualizados", checkbox queda marcado.
2. Refrescar la página, volver a seleccionar el mismo usuario → el rol tildado sigue marcado (persistió en `profile_roles`).
3. Abrir el menú de usuario propio (`UserMenu`) → el subtítulo muestra los roles propios unidos por coma.
4. Abrir "Perfil" (`PerfilModal`) → la sección "Roles" muestra un badge por cada rol propio.
5. Ir a `/admin/permisos`, seleccionar el mismo usuario de prueba → la columna "(rol: sí/no)" refleja permisos heredados de AMBOS roles asignados, no solo uno.

Si algún paso falla, volver a Fase 1 de systematic-debugging antes de parchear.

- [ ] **Step 4: Actualizar el spec si algo cambió**

Si algún detalle del diseño cambió durante la implementación, anotarlo en `docs/superpowers/specs/2026-07-14-multi-rol-usuarios-design.md`.
