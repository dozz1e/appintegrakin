# Overrides de permisos por usuario + widgets acoplados a permisos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a la dueña una pantalla para forzar el acceso de un usuario a cualquier permiso (override sobre su rol), y hacer que el catálogo de widgets del dashboard personal respete esos mismos permisos, tanto al asignar como al mostrar.

**Architecture:** Dos piezas independientes que comparten el mismo gate de acceso (`dashboard_widgets.assign`). Parte A expone tablas RLS ya existentes (`permissions`, `role_permissions`, `user_permission_overrides`) que hoy están bloqueadas por falta de políticas, y agrega una pantalla CRUD simple sobre `user_permission_overrides`. Parte B agrega una columna `resource` a `dashboard_widgets` y filtra en dos puntos: al asignar (vía la RPC `permisos_efectivos_usuario` ya existente) y al renderizar el dashboard propio (vía `usePermissions().can()`, ya cacheado en sesión).

**Tech Stack:** Nuxt 4 / Vue 3 / Supabase (Postgres + RLS) / Pinia no se usa para esto (sigue el patrón `useState` existente).

## Global Constraints

- Nunca usar `<component :is="stringName">` sin pasar por el `componentMap` explícito — el auto-import global de Nuxt no lo resuelve (gotcha documentado).
- `useSupabaseUser()` devuelve el JWT decodificado: el id de usuario está en `.sub`, no en `.id`.
- Componentes/composables nuevos requieren `rm -rf .nuxt && npm run dev` para aparecer (el hot-reload no alcanza).
- Las migraciones de este proyecto se aplican directo al único proyecto Supabase real (no hay branching disponible — se verificó y devuelve error). Cada `apply_migration` es un cambio en producción: pausar y confirmar con el usuario antes de cada uno, no encadenarlos.
- Nada de tests automatizados en este repo todavía — la verificación de cada tarea es SQL estructural (lo que el agente puede correr solo) + un checklist manual de navegador para el usuario al final.
- Estilo de código existente: sin comentarios explicativos salvo que documenten un porqué no obvio (ver los archivos ya presentes como referencia de tono).

---

### Task 1: Migración — políticas RLS para permissions/role_permissions/user_permission_overrides

**Files:**
- Create: `supabase/migrations/20260709000000_rls_permisos_admin.sql`

**Interfaces:**
- Produces: policies `permissions_select`, `role_permissions_select`, `user_permission_overrides_select`, `user_permission_overrides_write` — consumidas por el composable de la Task 2.

- [ ] **Step 1: Escribir el archivo de migración**

```sql
-- supabase/migrations/20260709000000_rls_permisos_admin.sql
--
-- permissions, role_permissions y user_permission_overrides tienen RLS
-- activado desde su creación pero sin ninguna política — hoy son
-- inaccesibles desde el cliente (solo se leen vía RPCs security definer
-- como has_permission/permisos_efectivos_usuario). Esta migración las
-- expone para la pantalla /admin/permisos, gateadas por el mismo permiso
-- que ya usa /admin/dashboards.

create policy permissions_select on permissions
for select using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));

create policy role_permissions_select on role_permissions
for select using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));

create policy user_permission_overrides_select on user_permission_overrides
for select using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));

create policy user_permission_overrides_write on user_permission_overrides
for all using (has_permission(auth.uid(), 'dashboard_widgets', 'assign'));
```

- [ ] **Step 2: Confirmar con el usuario y aplicar la migración a Supabase**

Antes de aplicar: avisar explícitamente que este paso escribe en el proyecto
Supabase real (no hay entorno de prueba separado) y esperar confirmación.

Aplicar con la tool `mcp__supabase__apply_migration`, `name: "rls_permisos_admin"`,
`query` = el contenido completo del Step 1.

- [ ] **Step 3: Verificar que las 4 políticas quedaron creadas**

Correr con `mcp__supabase__execute_sql`:

```sql
select tablename, policyname, cmd
from pg_policies
where tablename in ('permissions', 'role_permissions', 'user_permission_overrides')
order by tablename, policyname;
```

Expected: 4 filas — `permissions_select` (SELECT), `role_permissions_select`
(SELECT), `user_permission_overrides_select` (SELECT),
`user_permission_overrides_write` (ALL).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260709000000_rls_permisos_admin.sql
git commit -m "$(cat <<'EOF'
Exponer permissions/role_permissions/user_permission_overrides vía RLS

Las tres tablas tenían RLS activado sin políticas desde su creación
(inaccesibles desde el cliente). Se agregan políticas de lectura/escritura
gateadas por dashboard_widgets.assign, para la pantalla /admin/permisos.
EOF
)"
```

---

### Task 2: Pantalla `/admin/permisos` (overrides de permisos por usuario)

**Files:**
- Modify: `app/composables/useUsuarios.ts`
- Create: `app/composables/usePermisosOverrides.ts`
- Create: `app/pages/admin/permisos/index.vue`
- Modify: `app/layouts/default.vue`

**Interfaces:**
- Consumes: policies de Task 1; `usePermissions().can()`; `useToast().success/error`; `useSupabaseUser()`.
- Produces: `usePermisosOverrides()` con `fetchCatalogoPermisos()`, `fetchHeredadosDeRol(roleId)`, `fetchOverridesDeUsuario(userId)`, `setOverride(userId, permissionId, effect)`, `quitarOverride(userId, permissionId)`, `fetchRecursosVisiblesDeUsuario(userId)` — esta última la consume la Task 4.
- Produces: `Usuario.role_id: string | null` (nuevo campo) — lo consume esta misma tarea y no rompe a los consumidores existentes de `useUsuarios` (leads/tickets solo leen `id`/`full_name`/`email`/`role`).

- [ ] **Step 1: Agregar `role_id` a `useUsuarios`**

Reemplazar el contenido completo de `app/composables/useUsuarios.ts`:

```ts
// composables/useUsuarios.ts
// Lectura de profiles - usado para selectores de "asignar a" en leads/tickets,
// y para las pantallas de administración de dashboards/permisos.
// No incluye create/update/delete: eso se maneja fuera del cliente (ver migración
// 20260702000900_profiles_rls.sql).

export interface Usuario {
  id: string
  full_name: string | null
  email: string | null
  role_id: string | null
  role: { name: string } | null
}

export const useUsuarios = () => {
  const supabase = useSupabaseClient()

  const fetchUsuarios = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role_id, role:roles(name)')
      .eq('active', true)
      .order('full_name')
    if (error) throw error
    return data as unknown as Usuario[]
  }

  const fetchUsuariosPorRol = async (roleName: string) => {
    const todos = await fetchUsuarios()
    return todos.filter((u) => u.role?.name === roleName)
  }

  return { fetchUsuarios, fetchUsuariosPorRol }
}
```

- [ ] **Step 2: Verificar que profiles expone role_id vía RLS**

`profiles` ya tiene políticas desde `20260702000900_rls_profiles.sql` (usadas
hoy por `fetchUsuarios` para `id/full_name/email/role`). Confirmar que
`role_id` es una columna real y no está excluida por alguna política de
columnas (Postgres RLS no filtra por columna, solo por fila, así que no debería
haber problema — este paso es solo lectura de confirmación):

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'role_id';
```

Expected: 1 fila (`role_id`).

- [ ] **Step 3: Crear el composable `usePermisosOverrides`**

```ts
// composables/usePermisosOverrides.ts
// Overrides individuales de permisos, gestionados desde /admin/permisos.
// Solo funciona para quien tiene el permiso dashboard_widgets.assign (RLS,
// ver 20260709000000_rls_permisos_admin.sql).

export interface PermisoCatalogo {
  id: string
  resource: string
  action: string
}

export interface OverrideUsuario {
  permission_id: string
  effect: 'grant' | 'revoke'
}

export const usePermisosOverrides = () => {
  const supabase = useSupabaseClient()

  const fetchCatalogoPermisos = async () => {
    const { data, error } = await supabase
      .from('permissions')
      .select('id, resource, action')
      .order('resource', { ascending: true })
      .order('action', { ascending: true })
    if (error) throw error
    return data as PermisoCatalogo[]
  }

  const fetchHeredadosDeRol = async (roleId: string) => {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', roleId)
    if (error) throw error
    return new Set((data ?? []).map((r) => r.permission_id as string))
  }

  const fetchOverridesDeUsuario = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_permission_overrides')
      .select('permission_id, effect')
      .eq('user_id', userId)
    if (error) throw error
    return data as OverrideUsuario[]
  }

  const setOverride = async (userId: string, permissionId: string, effect: 'grant' | 'revoke') => {
    const { error } = await supabase
      .from('user_permission_overrides')
      .upsert({ user_id: userId, permission_id: permissionId, effect }, { onConflict: 'user_id,permission_id' })
    if (error) throw error
  }

  const quitarOverride = async (userId: string, permissionId: string) => {
    const { error } = await supabase
      .from('user_permission_overrides')
      .delete()
      .eq('user_id', userId)
      .eq('permission_id', permissionId)
    if (error) throw error
  }

  // Usado por /admin/dashboards (Task 4) para filtrar el catálogo de widgets
  // a solo los recursos que el usuario objetivo puede ver.
  const fetchRecursosVisiblesDeUsuario = async (userId: string) => {
    const { data, error } = await supabase.rpc('permisos_efectivos_usuario', { p_user: userId })
    if (error) throw error
    const recursos = new Set<string>()
    for (const row of (data ?? []) as { resource: string; action: string }[]) {
      if (row.action === 'view' || row.action === 'view_all') recursos.add(row.resource)
    }
    return recursos
  }

  return {
    fetchCatalogoPermisos,
    fetchHeredadosDeRol,
    fetchOverridesDeUsuario,
    setOverride,
    quitarOverride,
    fetchRecursosVisiblesDeUsuario,
  }
}
```

- [ ] **Step 4: Crear la página `/admin/permisos`**

```vue
<!-- app/pages/admin/permisos/index.vue -->
<script setup lang="ts">
import type { Usuario } from '~/composables/useUsuarios'
import type { PermisoCatalogo } from '~/composables/usePermisosOverrides'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'dashboard_widgets', actions: ['assign'] },
})

const { fetchCatalogoPermisos, fetchHeredadosDeRol, fetchOverridesDeUsuario, setOverride, quitarOverride } =
  usePermisosOverrides()
const { fetchUsuarios } = useUsuarios()
const { success, error } = useToast()
const usuarioActual = useSupabaseUser()

const catalogo = ref<PermisoCatalogo[]>([])
const usuarios = ref<Usuario[]>([])
const usuarioSeleccionado = ref('')
const heredados = ref<Set<string>>(new Set()) // permission_id con acceso vía rol
const overrides = ref<Map<string, 'grant' | 'revoke'>>(new Map()) // permission_id -> effect
const cargando = ref(true)
const cargandoUsuario = ref(false)

// Nadie puede editar sus propios permisos desde acá: evita que la dueña se
// revoque dashboard_widgets.assign a sí misma y quede sin acceso a esta
// misma pantalla (no hay UI para deshacer eso, solo SQL directo).
const usuariosSeleccionables = computed(() => usuarios.value.filter((u) => u.id !== usuarioActual.value?.sub))

const recursos = computed(() => Array.from(new Set(catalogo.value.map((p) => p.resource))).sort())

onMounted(async () => {
  catalogo.value = await fetchCatalogoPermisos()
  usuarios.value = await fetchUsuarios()
  cargando.value = false
})

const seleccionarUsuario = async (userId: string) => {
  usuarioSeleccionado.value = userId
  heredados.value = new Set()
  overrides.value = new Map()
  if (!userId) return

  cargandoUsuario.value = true
  const usuario = usuarios.value.find((u) => u.id === userId)
  if (usuario?.role_id) {
    heredados.value = await fetchHeredadosDeRol(usuario.role_id)
  }
  const filas = await fetchOverridesDeUsuario(userId)
  overrides.value = new Map(filas.map((f) => [f.permission_id, f.effect]))
  cargandoUsuario.value = false
}

const estadoDe = (permissionId: string): 'heredado' | 'grant' | 'revoke' => overrides.value.get(permissionId) ?? 'heredado'

const aplicarEstado = async (permissionId: string, estado: 'heredado' | 'grant' | 'revoke') => {
  if (!usuarioSeleccionado.value || estadoDe(permissionId) === estado) return

  try {
    if (estado === 'heredado') {
      await quitarOverride(usuarioSeleccionado.value, permissionId)
      overrides.value.delete(permissionId)
    } else {
      await setOverride(usuarioSeleccionado.value, permissionId, estado)
      overrides.value.set(permissionId, estado)
    }
    overrides.value = new Map(overrides.value)
    success('Permiso actualizado')
  } catch (e) {
    error('No se pudo actualizar el permiso')
  }
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <h1 class="text-lg font-semibold mb-2">Permisos por usuario</h1>
    <p class="text-sm text-gray-400 mb-6">
      Forzar el acceso de un usuario a una acción puntual, sin cambiar su rol. "Heredado" respeta lo que diga el rol;
      "Otorgar"/"Revocar" lo fuerzan independientemente del rol.
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

      <p v-if="usuarioSeleccionado && cargandoUsuario" class="text-gray-400">Cargando permisos...</p>

      <div v-else-if="usuarioSeleccionado" class="space-y-6">
        <div v-for="recurso in recursos" :key="recurso">
          <h2 class="text-xs font-semibold text-gray-400 uppercase mb-2">{{ recurso }}</h2>
          <ul class="space-y-1">
            <li
              v-for="p in catalogo.filter((c) => c.resource === recurso)"
              :key="p.id"
              class="flex items-center justify-between text-sm border rounded px-3 py-2"
            >
              <div>
                <span class="font-medium">{{ p.action }}</span>
                <span class="text-gray-400 ml-2">(rol: {{ heredados.has(p.id) ? 'sí' : 'no' }})</span>
              </div>
              <div class="flex gap-1">
                <button
                  class="text-xs px-2 py-1 rounded"
                  :class="estadoDe(p.id) === 'heredado' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'"
                  @click="aplicarEstado(p.id, 'heredado')"
                >
                  Heredado
                </button>
                <button
                  class="text-xs px-2 py-1 rounded"
                  :class="estadoDe(p.id) === 'grant' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'"
                  @click="aplicarEstado(p.id, 'grant')"
                >
                  Otorgar
                </button>
                <button
                  class="text-xs px-2 py-1 rounded"
                  :class="estadoDe(p.id) === 'revoke' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'"
                  @click="aplicarEstado(p.id, 'revoke')"
                >
                  Revocar
                </button>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 5: Agregar el link "Permisos" al sidebar**

En `app/layouts/default.vue`, dentro del bloque `<div v-if="can('dashboard_widgets', 'assign') || can('auditoria', 'view_all')">`,
insertar el nuevo `NuxtLink` inmediatamente después del de "Dashboards"
(antes del de "Auditoría"):

```html
          <NuxtLink
            v-if="can('dashboard_widgets', 'assign')"
            to="/admin/permisos"
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="esActivo('/admin/permisos')
              ? 'bg-[#EAF4FA] text-[#0C5D91]'
              : 'text-gray-600 hover:bg-gray-50'"
          >
            Permisos
          </NuxtLink>
```

- [ ] **Step 6: `rm -rf .nuxt` y levantar el dev server**

```bash
rm -rf .nuxt
npm run dev
```

Esperar la línea `Local: http://localhost:3000/` antes de continuar.

- [ ] **Step 7: Checklist manual de navegador (para el usuario)**

1. Login como la dueña.
2. Confirmar que aparece "Permisos" en el sidebar, sección Administración.
3. Entrar a `/admin/permisos`. El selector de usuario **no debe** ofrecer la
   cuenta de la dueña (autoedición bloqueada).
4. Seleccionar un usuario de prueba. Confirmar que se listan los 8 grupos de
   recursos con sus acciones, cada uno con 3 botones.
5. Click en "Revocar" sobre `tickets` → `view` y `view_all` para ese usuario.
   Confirmar el toast "Permiso actualizado" y que el botón "Revocar" queda
   resaltado.
6. Recargar la página, volver a seleccionar el mismo usuario: confirmar que
   el estado "Revocar" persiste (se guardó en la base, no es solo estado local).
7. Login como ese usuario de prueba: confirmar que "Tickets" desapareció del
   sidebar y que navegar a `/tickets` directamente redirige a `/403`.

- [ ] **Step 8: Detener el servidor y commitear**

```bash
git add app/composables/useUsuarios.ts app/composables/usePermisosOverrides.ts app/pages/admin/permisos/index.vue app/layouts/default.vue
git commit -m "$(cat <<'EOF'
Agregar pantalla /admin/permisos para overrides de permisos por usuario

Permite forzar el acceso de un usuario a cualquier permiso (Heredado/
Otorgar/Revocar) sin cambiar su rol. Selector de usuario excluye la
cuenta logueada para evitar que quien administra se bloquee a sí misma.
EOF
)"
```

---

### Task 3: Migración — `dashboard_widgets.resource` + actualizar `mis_widgets()`

**Files:**
- Create: `supabase/migrations/20260709000100_dashboard_widgets_resource.sql`

**Interfaces:**
- Produces: columna `dashboard_widgets.resource text not null`; `mis_widgets()` ahora devuelve también `resource` — lo consume la Task 5 (`MiWidget.resource`).

- [ ] **Step 1: Escribir el archivo de migración**

```sql
-- supabase/migrations/20260709000100_dashboard_widgets_resource.sql
--
-- Acopla el catálogo de dashboard_widgets al sistema de permisos: cada
-- widget declara a qué resource pertenece, para poder filtrar tanto al
-- asignarlo (admin/dashboards, Task 4) como al renderizarlo en el
-- dashboard propio del usuario (index.vue, Task 5).

alter table dashboard_widgets add column resource text;

update dashboard_widgets set resource = 'leads'    where key = 'kpi.leads_activos';
update dashboard_widgets set resource = 'tickets'  where key = 'kpi.tickets_abiertos';
update dashboard_widgets set resource = 'clientes' where key = 'kpi.clientes_totales';
update dashboard_widgets set resource = 'leads'    where key = 'chart.leads_por_estado';
update dashboard_widgets set resource = 'leads'    where key = 'kpi.tasa_conversion';

alter table dashboard_widgets alter column resource set not null;

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

- [ ] **Step 2: Confirmar con el usuario y aplicar la migración a Supabase**

Mismo aviso que en Task 1, Step 2: cambio directo a producción, esperar
confirmación antes de aplicar.

Aplicar con `mcp__supabase__apply_migration`, `name: "dashboard_widgets_resource"`,
`query` = el contenido completo del Step 1.

- [ ] **Step 3: Verificar backfill y la nueva firma de `mis_widgets()`**

```sql
select key, resource from dashboard_widgets order by key;
```

Expected: 5 filas, ninguna con `resource` nulo, valores exactamente
`leads/tickets/clientes/leads/leads` para
`kpi.leads_activos/kpi.tickets_abiertos/kpi.clientes_totales/chart.leads_por_estado/kpi.tasa_conversion`.

```sql
select pg_get_function_result('mis_widgets'::regproc);
```

Expected: incluye `resource text` en la lista de columnas devueltas.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260709000100_dashboard_widgets_resource.sql
git commit -m "$(cat <<'EOF'
Agregar dashboard_widgets.resource y exponerlo en mis_widgets()

Primer paso para acoplar el catálogo de widgets del dashboard al
sistema de permisos existente: cada widget ahora declara a qué
resource pertenece (leads/tickets/clientes).
EOF
)"
```

---

### Task 4: Filtrar el catálogo de widgets al asignar (`/admin/dashboards`)

**Files:**
- Modify: `app/composables/useDashboardWidgets.ts`
- Modify: `app/pages/admin/dashboards/index.vue`

**Interfaces:**
- Consumes: `usePermisosOverrides().fetchRecursosVisiblesDeUsuario(userId)` (Task 2).
- Produces: `WidgetCatalogo.resource: string` — ya no debería usarse `catalogo` crudo en el template de esta página, solo `catalogoFiltrado`.

- [ ] **Step 1: Agregar `resource` a las interfaces de `useDashboardWidgets`**

En `app/composables/useDashboardWidgets.ts`, reemplazar las dos interfaces del
inicio del archivo (el resto del archivo no cambia):

```ts
export interface MiWidget {
  key: string
  label: string
  component: string
  resource: string
  tipo: 'kpi' | 'chart'
  orden: number
  config: Record<string, unknown>
}

export interface WidgetCatalogo {
  id: string
  key: string
  label: string
  component: string
  resource: string
  tipo: 'kpi' | 'chart'
  descripcion: string | null
}
```

- [ ] **Step 2: Filtrar el catálogo en `admin/dashboards/index.vue`**

Reemplazar el bloque `<script setup>` completo:

```vue
<script setup lang="ts">
import type { WidgetCatalogo } from '~/composables/useDashboardWidgets'
import type { Usuario } from '~/composables/useUsuarios'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'dashboard_widgets', actions: ['assign'] },
})

const { fetchCatalogo, fetchWidgetsDeUsuario, asignarWidget, quitarWidget } = useDashboardWidgets()
const { fetchUsuarios } = useUsuarios()
const { fetchRecursosVisiblesDeUsuario } = usePermisosOverrides()
const { success, error } = useToast()

const catalogo = ref<WidgetCatalogo[]>([])
const usuarios = ref<Usuario[]>([])
const usuarioSeleccionado = ref('')
const widgetsAsignados = ref<Set<string>>(new Set()) // widget_id
const recursosVisibles = ref<Set<string>>(new Set())
const cargando = ref(true)

const catalogoFiltrado = computed(() => catalogo.value.filter((w) => recursosVisibles.value.has(w.resource)))

onMounted(async () => {
  catalogo.value = await fetchCatalogo()
  usuarios.value = await fetchUsuarios()
  cargando.value = false
})

const seleccionarUsuario = async (userId: string) => {
  usuarioSeleccionado.value = userId
  if (!userId) {
    widgetsAsignados.value = new Set()
    recursosVisibles.value = new Set()
    return
  }
  const rows = await fetchWidgetsDeUsuario(userId)
  widgetsAsignados.value = new Set(rows.map((r) => r.widget_id))
  recursosVisibles.value = await fetchRecursosVisiblesDeUsuario(userId)
}

const toggleWidget = async (widgetId: string) => {
  if (!usuarioSeleccionado.value) return
  try {
    if (widgetsAsignados.value.has(widgetId)) {
      await quitarWidget(usuarioSeleccionado.value, widgetId)
      widgetsAsignados.value.delete(widgetId)
      success('Widget quitado')
    } else {
      await asignarWidget(usuarioSeleccionado.value, widgetId, widgetsAsignados.value.size)
      widgetsAsignados.value.add(widgetId)
      success('Widget asignado')
    }
    widgetsAsignados.value = new Set(widgetsAsignados.value)
  } catch (e) {
    error('No se pudo actualizar la asignación')
  }
}
</script>
```

En el `<template>`, la única línea que cambia es la del `v-for` de la lista de
widgets: reemplazar

```html
              v-for="w in catalogo.filter((c) => c.tipo === tipo)"
```

por

```html
              v-for="w in catalogoFiltrado.filter((c) => c.tipo === tipo)"
```

(el resto del template queda exactamente igual).

- [ ] **Step 3: `rm -rf .nuxt` y levantar el dev server**

```bash
rm -rf .nuxt
npm run dev
```

- [ ] **Step 4: Checklist manual de navegador (para el usuario)**

1. En `/admin/permisos`, confirmar que el usuario de prueba de la Task 2 sigue
   sin `tickets.view`/`tickets.view_all` (revocado en ese checklist).
2. Ir a `/admin/dashboards`, seleccionar ese mismo usuario.
3. Confirmar que "Tickets abiertos" **no aparece** en la lista de KPIs
   asignables (el resto sí: Leads activos, Clientes totales, Leads por
   estado, Tasa de conversión).
4. Seleccionar un usuario CON acceso a tickets: confirmar que "Tickets
   abiertos" sí aparece.

- [ ] **Step 5: Detener el servidor y commitear**

```bash
git add app/composables/useDashboardWidgets.ts app/pages/admin/dashboards/index.vue
git commit -m "$(cat <<'EOF'
Filtrar catálogo de widgets por los permisos del usuario a asignar

En /admin/dashboards ya no se puede ofrecer un widget de un recurso al
que el usuario objetivo no tiene acceso (ej. Tickets abiertos a alguien
sin permiso sobre tickets).
EOF
)"
```

---

### Task 5: Ocultar widgets ya asignados si se pierde el permiso (`/`)

**Files:**
- Modify: `app/pages/index.vue`

**Interfaces:**
- Consumes: `usePermissions().can()` (ya cargado por `auth.global.ts` antes de que esta página monte); `MiWidget.resource` (Task 3/4).

- [ ] **Step 1: Reemplazar el archivo completo**

```vue
<!-- app/pages/index.vue -->
<script setup lang="ts">
// Home = dashboard personal. Cada usuario ve solo los widgets que le
// asignó la dueña o el superadmin (tabla user_dashboard_widgets) Y que
// además puede ver según sus permisos actuales (si se le asignó un widget
// y luego se le revocó el acceso a esa página, el widget deja de mostrarse
// sin que haya que ir a desasignarlo a mano).
//
// El componente se resuelve con un mapa explícito, NO con <component :is="string">
// dependiendo del registro global de Nuxt (por defecto Nuxt NO registra los
// componentes globalmente, solo los importa cuando se usan como etiqueta fija
// en un template - eso rompe la resolución dinámica por string sin avisar).
//
// Al agregar un widget nuevo: import + agregar la línea en componentMap. Sí,
// es un paso manual extra, pero es explícito y no depende de configuración
// oculta de Nuxt que ya nos mordió una vez.

import KpiClientesTotales from '~/components/widgets/KpiClientesTotales.vue'
import KpiLeadsActivos from '~/components/widgets/KpiLeadsActivos.vue'
import KpiTicketsAbiertos from '~/components/widgets/KpiTicketsAbiertos.vue'
import ChartLeadsPorEstado from '~/components/widgets/ChartLeadsPorEstado.vue'
import KpiTasaConversion from '~/components/widgets/KpiTasaConversion.vue'

const componentMap: Record<string, any> = {
  WidgetsKpiClientesTotales: KpiClientesTotales,
  WidgetsKpiLeadsActivos: KpiLeadsActivos,
  WidgetsKpiTicketsAbiertos: KpiTicketsAbiertos,
  WidgetsChartLeadsPorEstado: ChartLeadsPorEstado,
  WidgetsKpiTasaConversion: KpiTasaConversion,
}

const { misWidgets, cargarMisWidgets } = useDashboardWidgets()
const { can } = usePermissions()
const cargando = ref(true)

onMounted(async () => {
  await cargarMisWidgets()
  cargando.value = false
})

const widgetsVisibles = computed(() => misWidgets.value.filter((w) => can(w.resource, 'view') || can(w.resource, 'view_all')))
</script>

<template>
  <div class="p-6">
    <h1 class="text-xl font-semibold mb-6">Tu dashboard</h1>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>

    <p v-else-if="widgetsVisibles.length === 0" class="text-gray-400 text-sm">
      Todavía no tienes ningún widget asignado. Pídele a tu administrador que te active
      alguno desde el panel de dashboards.
    </p>

    <p v-else-if="widgetsVisibles.some((w) => !componentMap[w.component])" class="text-red-500 text-sm">
      Un widget asignado no tiene componente registrado en el mapa (revisa la consola).
    </p>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <component
        :is="componentMap[w.component]"
        v-for="w in widgetsVisibles"
        :key="w.key"
        v-bind="w.config"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 2: `rm -rf .nuxt` y levantar el dev server**

```bash
rm -rf .nuxt
npm run dev
```

- [ ] **Step 3: Checklist manual de navegador (para el usuario) — cierra el ciclo completo**

1. Como dueña, en `/admin/dashboards`, seleccionar un usuario de prueba QUE
   TENGA acceso a tickets. Asignarle el widget "Tickets abiertos".
2. Login como ese usuario: confirmar que "Tickets abiertos" aparece en `/`.
3. Volver a loguearse como la dueña, ir a `/admin/permisos`, seleccionar ese
   mismo usuario, revocar `tickets.view` y `tickets.view_all`.
4. Login de nuevo como ese usuario, recargar `/`: confirmar que "Tickets
   abiertos" **ya no aparece**, aunque la asignación en `user_dashboard_widgets`
   sigue existiendo (no hace falta ir a `/admin/dashboards` a desasignarlo).
5. Confirmar en consola del navegador que no hay errores nuevos
   (`widgetsVisibles.some((w) => !componentMap[w.component])` no debería
   dispararse para ningún widget del catálogo actual).

- [ ] **Step 4: Detener el servidor y commitear**

```bash
git add app/pages/index.vue
git commit -m "$(cat <<'EOF'
Ocultar en el dashboard propio los widgets sin permiso vigente

Si a un usuario se le revoca el acceso a un recurso después de haberle
asignado un widget de ese recurso, el widget deja de renderizarse sin
necesidad de desasignarlo manualmente desde /admin/dashboards.
EOF
)"
```

---

## Self-Review (completado durante la escritura del plan)

**Cobertura del spec:**
- Parte A (pantalla de overrides, salvaguarda de autoedición, 24 permisos, botones Heredado/Otorgar/Revocar, link de sidebar) → Task 1 + Task 2. ✓
- Parte B (columna `resource`, filtro al asignar, filtro al renderizar) → Task 3 + Task 4 + Task 5. ✓
- Testing manual descrito en el spec → checklist en Steps finales de Task 2, 4 y 5, encadenados (Task 5 depende del estado dejado por Task 2 y Task 4). ✓
- "Fuera de alcance" del spec (reportes, widgets nuevos, multi-admin) → no se tocó ningún archivo de `/reportes` ni se crearon widgets nuevos. ✓

**Placeholders:** ninguno — todo paso de código trae el archivo completo o el fragmento exacto a insertar/reemplazar, sin "TODO"/"similar a".

**Consistencia de tipos:** `MiWidget.resource`/`WidgetCatalogo.resource` (Task 4) coinciden con la columna `resource` agregada en Task 3 y con el `select` de `mis_widgets()`. `usePermisosOverrides().fetchRecursosVisiblesDeUsuario` (Task 2) es exactamente el nombre que consume Task 4. `Usuario.role_id` (Task 2, Step 1) es el campo que lee la página de Task 2, Step 4.
