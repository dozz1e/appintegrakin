# Menú de usuario, perfil editable y configuración — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el bloque estático de avatar+nombre+rol+"Salir" del header por un menú desplegable con Perfil (editar nombre y foto), Configuración (umbral de aviso de tareas próximas) y Salir.

**Architecture:** Dos columnas nuevas en `profiles` (`avatar_url`, `settings jsonb`) + bucket de storage `perfiles-imagenes` con escritura por path propio. `useMiPerfil.ts` se extiende con funciones de actualización. Dos modales nuevos (Perfil, Configuración) montados desde un nuevo `SharedUserMenu.vue` que reemplaza el bloque actual en `layouts/default.vue`. `useTareas.ts` deja de usar un umbral fijo y lee el de `profiles.settings`.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup>`, Supabase (Postgres + Storage + RLS), Tailwind. Sin framework de tests instalado (`package.json` no tiene `vitest`/`jest`) — verificación vía `npm run build` + pasos manuales en `nuxt dev`, mismo patrón usado en el resto del proyecto.

## Global Constraints

- Español latinoamericano en toda copy visible al usuario (labels, placeholders, mensajes de toast), sin voseo.
- Seguir el patrón de componentes `app/components/shared/X.vue` → auto-importado como `SharedX`.
- Seguir el patrón de composables existentes: `useSupabaseClient()`, `useSupabaseUser()`, `.sub` (no `.id`) para el uid del JWT.
- Migraciones de Supabase: escribir el archivo en `supabase/migrations/` Y aplicarlo con la tool `mcp__supabase__apply_migration` (proyecto real, no hay entorno local separado en este flujo).
- No agregar campos ni funcionalidad fuera de lo listado en el spec (`docs/superpowers/specs/2026-07-13-user-menu-profile-config-design.md`): sin cambio de contraseña/email, sin teléfono, sin configuraciones especulativas.

---

## Task 1: Migración — columnas `avatar_url` y `settings` en `profiles`

**Files:**
- Create: `supabase/migrations/20260713000800_perfiles_avatar_settings.sql`

**Interfaces:**
- Produces: columnas `profiles.avatar_url text` (nullable) y `profiles.settings jsonb not null default '{}'`, usadas por Task 3.

- [ ] **Step 1: Escribir el archivo de migración**

```sql
-- supabase/migrations/20260713000800_perfiles_avatar_settings.sql
--
-- avatar_url: foto de perfil del usuario (bucket perfiles-imagenes, ver
-- migración siguiente). settings: configuraciones personales del usuario
-- en jsonb libre, para no requerir una migración por cada configuración
-- nueva (empieza con la key "umbral_alertas_minutos", resuelta en código
-- con default 30 cuando no está presente — no se preseedea acá).
--
-- No hace falta política RLS nueva: profiles_update_own
-- (20260702000900_rls_profiles.sql:18-19) ya permite a cada usuario
-- actualizar su propia fila, y proteger_cambio_rol solo bloquea
-- role_id/active.

alter table profiles add column avatar_url text;
alter table profiles add column settings jsonb not null default '{}';
```

- [ ] **Step 2: Aplicar la migración**

Usar la tool `mcp__supabase__apply_migration` con:
- `name`: `perfiles_avatar_settings`
- `query`: el contenido SQL del Step 1 (sin los comentarios `--` iniciales del nombre de archivo, el resto tal cual)

- [ ] **Step 3: Verificar columnas creadas**

Usar la tool `mcp__supabase__execute_sql` con:
```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'profiles' and column_name in ('avatar_url', 'settings');
```
Expected: dos filas, `avatar_url` (`text`, default null) y `settings` (`jsonb`, default `'{}'::jsonb`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260713000800_perfiles_avatar_settings.sql
git commit -m "feat: agregar avatar_url y settings a profiles"
```

---

## Task 2: Migración — bucket de storage `perfiles-imagenes`

**Files:**
- Create: `supabase/migrations/20260713000900_perfiles_imagenes_storage.sql`

**Interfaces:**
- Produces: bucket público `perfiles-imagenes` en Supabase Storage, con policies que solo permiten escribir/actualizar/borrar dentro de la carpeta `${auth.uid()}/...`. Usado por `subirFotoPerfil` en Task 3.

- [ ] **Step 1: Escribir el archivo de migración**

```sql
-- supabase/migrations/20260713000900_perfiles_imagenes_storage.sql
--
-- Mismo patrón que clientes-imagenes (20260712000000_imagen_cliente.sql)
-- pero la escritura se gatea por path propio (carpeta = auth.uid()), no
-- por permiso de recurso: una foto de perfil es personal, no depende de
-- has_permission.

insert into storage.buckets (id, name, public)
values ('perfiles-imagenes', 'perfiles-imagenes', true)
on conflict (id) do nothing;

create policy perfiles_imagenes_select on storage.objects
for select using (bucket_id = 'perfiles-imagenes');

create policy perfiles_imagenes_insert on storage.objects
for insert with check (
  bucket_id = 'perfiles-imagenes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy perfiles_imagenes_update on storage.objects
for update using (
  bucket_id = 'perfiles-imagenes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy perfiles_imagenes_delete on storage.objects
for delete using (
  bucket_id = 'perfiles-imagenes'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

- [ ] **Step 2: Aplicar la migración**

Usar la tool `mcp__supabase__apply_migration` con:
- `name`: `perfiles_imagenes_storage`
- `query`: el contenido SQL del Step 1

- [ ] **Step 3: Verificar bucket creado**

Usar la tool `mcp__supabase__execute_sql` con:
```sql
select id, public from storage.buckets where id = 'perfiles-imagenes';
```
Expected: una fila, `public = true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260713000900_perfiles_imagenes_storage.sql
git commit -m "feat: bucket de storage perfiles-imagenes con policy por path propio"
```

---

## Task 3: Extender `useMiPerfil.ts`

**Files:**
- Modify: `app/composables/useMiPerfil.ts` (reemplazo completo del archivo)

**Interfaces:**
- Consumes: columnas `profiles.avatar_url`, `profiles.settings` (Task 1), bucket `perfiles-imagenes` (Task 2).
- Produces:
  - `interface MiPerfil { id: string; full_name: string | null; email: string | null; role: string | null; avatar_url: string | null; settings: Record<string, unknown> }`
  - `perfil: Ref<MiPerfil | null>`
  - `cargarMiPerfil(): Promise<void>`
  - `actualizarMiPerfil(payload: { full_name?: string; avatar_url?: string }): Promise<void>`
  - `actualizarConfiguracion(patch: Record<string, unknown>): Promise<void>`
  - `subirFotoPerfil(archivo: File): Promise<string>`
  - Usados por Task 5 (`SharedPerfilModal.vue`), Task 6 (`SharedConfiguracionModal.vue`), Task 7 (`SharedUserMenu.vue`), Task 9 (`useTareas.ts`).

- [ ] **Step 1: Reemplazar el archivo completo**

```ts
// composables/useMiPerfil.ts
// Reemplaza intencionalmente al usePerfilActual.ts huérfano que borramos -
// mismo propósito, pero con el guard correcto y usando .sub (no .id).

export interface MiPerfil {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  avatar_url: string | null
  settings: Record<string, unknown>
}

type FilaPerfil = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  settings: Record<string, unknown> | null
  role: { name: string } | null
}

function mapearPerfil(data: FilaPerfil): MiPerfil {
  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    avatar_url: data.avatar_url,
    settings: data.settings ?? {},
    role: data.role?.name ?? null,
  }
}

const SELECT_PERFIL = 'id, full_name, email, avatar_url, settings, role:roles(name)'

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
    if (!user.value?.sub) return
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
    if (!user.value?.sub) return
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

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: termina con `✨ Build complete!`, sin errores de TypeScript relacionados a `useMiPerfil`.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useMiPerfil.ts
git commit -m "feat: extender useMiPerfil con avatar, settings y funciones de actualización"
```

---

## Task 4: `SharedModal.vue` — modal genérico

**Files:**
- Create: `app/components/shared/Modal.vue`

**Interfaces:**
- Produces: componente `SharedModal` con props `{ open: boolean; titulo: string }`, emit `cerrar: []`, slot por defecto para el contenido. Usado por Task 5 y Task 6.

- [ ] **Step 1: Crear el componente**

```vue
<script setup lang="ts">
defineProps<{ open: boolean; titulo: string }>()
defineEmits<{ cerrar: [] }>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      @click.self="$emit('cerrar')"
    >
      <div class="bg-surface rounded-2xl border border-border shadow-lg p-6 w-full max-w-sm">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-ink">{{ titulo }}</h2>
          <button
            type="button"
            class="text-ink-muted hover:text-ink transition-colors duration-150"
            @click="$emit('cerrar')"
          >
            <Icon name="mdi:close" class="w-5 h-5" />
          </button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: `✨ Build complete!` (el componente no se usa todavía en ninguna página, el build solo valida sintaxis).

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/Modal.vue
git commit -m "feat: agregar SharedModal genérico"
```

---

## Task 5: `SharedPerfilModal.vue`

**Files:**
- Create: `app/components/shared/PerfilModal.vue`

**Interfaces:**
- Consumes: `SharedModal` (Task 4), `SharedAvatar` (existente, props `nombre`, `imagenUrl`, `size`), `SharedBadge` (existente, props `label`, `clases`), `useMiPerfil()` → `perfil`, `actualizarMiPerfil`, `subirFotoPerfil` (Task 3), `useToast()` → `success`, `error` (existente).
- Produces: componente `SharedPerfilModal` con prop `{ open: boolean }`, emit `cerrar: []`. Usado por Task 7.

- [ ] **Step 1: Crear el componente**

```vue
<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ cerrar: [] }>()

const { perfil, actualizarMiPerfil, subirFotoPerfil } = useMiPerfil()
const { success, error } = useToast()

const nombre = ref('')
const guardando = ref(false)
const subiendoFoto = ref(false)
const inputArchivo = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  (abierto) => {
    if (abierto) nombre.value = perfil.value?.full_name ?? ''
  }
)

async function onCambiarFoto(e: Event) {
  const archivo = (e.target as HTMLInputElement).files?.[0]
  if (!archivo) return
  subiendoFoto.value = true
  try {
    const url = await subirFotoPerfil(archivo)
    await actualizarMiPerfil({ avatar_url: url })
    success('Foto actualizada')
  } catch (e) {
    error('No se pudo subir la foto')
  } finally {
    subiendoFoto.value = false
    if (inputArchivo.value) inputArchivo.value.value = ''
  }
}

async function onGuardar() {
  if (!nombre.value.trim()) return
  guardando.value = true
  try {
    await actualizarMiPerfil({ full_name: nombre.value.trim() })
    success('Perfil actualizado')
    emit('cerrar')
  } catch (e) {
    error('No se pudo guardar el perfil')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <SharedModal :open="open" titulo="Mi perfil" @cerrar="$emit('cerrar')">
    <div class="flex flex-col items-center gap-2 mb-5">
      <SharedAvatar
        :nombre="perfil?.full_name || perfil?.email || '?'"
        :imagen-url="perfil?.avatar_url"
        size="md"
      />
      <button
        type="button"
        :disabled="subiendoFoto"
        class="text-xs text-primary hover:underline disabled:opacity-50"
        @click="inputArchivo?.click()"
      >
        {{ subiendoFoto ? 'Subiendo...' : 'Cambiar foto' }}
      </button>
      <input ref="inputArchivo" type="file" accept="image/*" class="hidden" @change="onCambiarFoto" />
    </div>

    <div class="space-y-3">
      <div>
        <label class="block text-xs font-medium text-ink-muted mb-1">Nombre</label>
        <input
          v-model="nombre"
          type="text"
          class="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-muted mb-1">Email</label>
        <p class="text-sm text-ink-secondary">{{ perfil?.email }}</p>
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-muted mb-1">Rol</label>
        <SharedBadge :label="perfil?.role ?? '—'" clases="bg-neutral-bg text-neutral-text" />
      </div>
    </div>

    <div class="flex justify-end mt-6">
      <button
        type="button"
        :disabled="guardando"
        class="bg-primary hover:bg-primary-hover text-ink-onprimary px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50"
        @click="onGuardar"
      >
        {{ guardando ? 'Guardando...' : 'Guardar' }}
      </button>
    </div>
  </SharedModal>
</template>
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: `✨ Build complete!`.

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/PerfilModal.vue
git commit -m "feat: agregar SharedPerfilModal para editar nombre y foto"
```

---

## Task 6: `SharedConfiguracionModal.vue`

**Files:**
- Create: `app/components/shared/ConfiguracionModal.vue`

**Interfaces:**
- Consumes: `SharedModal` (Task 4), `useMiPerfil()` → `perfil`, `actualizarConfiguracion` (Task 3), `useToast()` (existente).
- Produces: componente `SharedConfiguracionModal` con prop `{ open: boolean }`, emit `cerrar: []`. Usado por Task 7.

- [ ] **Step 1: Crear el componente**

```vue
<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ cerrar: [] }>()

const { perfil, actualizarConfiguracion } = useMiPerfil()
const { success, error } = useToast()

const umbralMinutos = ref(30)
const guardando = ref(false)

watch(
  () => props.open,
  (abierto) => {
    if (!abierto) return
    const valor = perfil.value?.settings?.umbral_alertas_minutos
    umbralMinutos.value = typeof valor === 'number' ? valor : 30
  }
)

async function onGuardar() {
  if (umbralMinutos.value < 1) return
  guardando.value = true
  try {
    await actualizarConfiguracion({ umbral_alertas_minutos: umbralMinutos.value })
    success('Configuración guardada')
    emit('cerrar')
  } catch (e) {
    error('No se pudo guardar la configuración')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <SharedModal :open="open" titulo="Configuración" @cerrar="$emit('cerrar')">
    <div>
      <label class="block text-xs font-medium text-ink-muted mb-1">
        Avisar tareas próximas a vencer con cuántos minutos de anticipación
      </label>
      <input
        v-model.number="umbralMinutos"
        type="number"
        min="1"
        class="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
      />
    </div>

    <div class="flex justify-end mt-6">
      <button
        type="button"
        :disabled="guardando"
        class="bg-primary hover:bg-primary-hover text-ink-onprimary px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50"
        @click="onGuardar"
      >
        {{ guardando ? 'Guardando...' : 'Guardar' }}
      </button>
    </div>
  </SharedModal>
</template>
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: `✨ Build complete!`.

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/ConfiguracionModal.vue
git commit -m "feat: agregar SharedConfiguracionModal para umbral de alertas"
```

---

## Task 7: `SharedUserMenu.vue`

**Files:**
- Create: `app/components/shared/UserMenu.vue`

**Interfaces:**
- Consumes: `useMiPerfil()` → `perfil` (Task 3), `useAuth()` → `logout` (existente, `app/composables/useAuth.ts`), `SharedAvatar` (existente), `SharedPerfilModal` (Task 5), `SharedConfiguracionModal` (Task 6).
- Produces: componente `SharedUserMenu`, sin props. Usado por Task 8 en `layouts/default.vue`.

- [ ] **Step 1: Crear el componente**

```vue
<script setup lang="ts">
const { perfil } = useMiPerfil()
const { logout } = useAuth()

const abierto = ref(false)
const perfilAbierto = ref(false)
const configuracionAbierta = ref(false)
const contenedor = ref<HTMLElement | null>(null)

onMounted(() => {
  document.addEventListener('click', onClickFuera)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickFuera)
})

function onClickFuera(e: MouseEvent) {
  if (contenedor.value && !contenedor.value.contains(e.target as Node)) abierto.value = false
}

function abrirPerfil() {
  abierto.value = false
  perfilAbierto.value = true
}

function abrirConfiguracion() {
  abierto.value = false
  configuracionAbierta.value = true
}
</script>

<template>
  <div ref="contenedor" class="relative">
    <button
      class="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-surface-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
      @click="abierto = !abierto"
    >
      <SharedAvatar
        v-if="perfil?.full_name || perfil?.email"
        :nombre="perfil.full_name || perfil.email || '?'"
        :imagen-url="perfil.avatar_url"
      />
      <div class="text-right hidden sm:block">
        <p class="text-sm font-medium text-ink leading-tight">
          {{ perfil?.full_name || perfil?.email || '...' }}
        </p>
        <p class="text-xs text-ink-muted leading-tight capitalize">{{ perfil?.role || '' }}</p>
      </div>
    </button>

    <div
      v-if="abierto"
      class="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-xl shadow-lg z-50 py-1"
    >
      <div class="px-4 py-3 border-b border-border">
        <p class="text-sm font-medium text-ink truncate">{{ perfil?.full_name || perfil?.email }}</p>
        <p class="text-xs text-ink-muted truncate">{{ perfil?.email }}</p>
      </div>
      <button
        type="button"
        class="w-full text-left px-4 py-2 text-sm text-ink hover:bg-surface-2 transition-colors duration-150"
        @click="abrirPerfil"
      >
        Perfil
      </button>
      <button
        type="button"
        class="w-full text-left px-4 py-2 text-sm text-ink hover:bg-surface-2 transition-colors duration-150"
        @click="abrirConfiguracion"
      >
        Configuración
      </button>
      <hr class="border-border my-1" />
      <button
        type="button"
        class="w-full text-left px-4 py-2 text-sm text-danger hover:bg-surface-2 transition-colors duration-150"
        @click="logout"
      >
        Salir
      </button>
    </div>

    <SharedPerfilModal :open="perfilAbierto" @cerrar="perfilAbierto = false" />
    <SharedConfiguracionModal :open="configuracionAbierta" @cerrar="configuracionAbierta = false" />
  </div>
</template>
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: `✨ Build complete!`.

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/UserMenu.vue
git commit -m "feat: agregar SharedUserMenu con dropdown de perfil/configuración/salir"
```

---

## Task 8: Wirear `SharedUserMenu` en `layouts/default.vue`

**Files:**
- Modify: `app/layouts/default.vue:9,89-105`

**Interfaces:**
- Consumes: `SharedUserMenu` (Task 7).

- [ ] **Step 1: Quitar `useAuth`/`logout` del script (ya no se usa directo acá)**

En `app/layouts/default.vue`, el script tiene hoy:

```ts
const { perfil, cargarMiPerfil } = useMiPerfil()
const { logout } = useAuth()
```

Reemplazar por:

```ts
const { perfil, cargarMiPerfil } = useMiPerfil()
```

- [ ] **Step 2: Reemplazar el bloque del header**

Buscar este bloque (dentro de `<div class="flex items-center gap-3">` en el `<header>`):

```html
        <div class="flex items-center gap-3">
          <SharedNotificationBell />
          <SharedAvatar v-if="perfil?.full_name || perfil?.email" :nombre="perfil.full_name || perfil.email || '?'" />
          <div class="text-right hidden sm:block">
            <p class="text-sm font-medium text-ink leading-tight">
              {{ perfil?.full_name || perfil?.email || '...' }}
            </p>
            <p class="text-xs text-ink-muted leading-tight capitalize">{{ perfil?.role || '' }}</p>
          </div>
          <button
            title="Cerrar sesión"
            class="text-ink-muted hover:text-danger text-sm px-2 py-1 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
            @click="logout"
          >
            Salir
          </button>
        </div>
```

Reemplazar por:

```html
        <div class="flex items-center gap-3">
          <SharedNotificationBell />
          <SharedUserMenu />
        </div>
```

`perfil` sigue siendo necesario en el script (se usa en el `onMounted` para precargar), así que la línea `const { perfil, cargarMiPerfil } = useMiPerfil()` no cambia más allá del Step 1.

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: `✨ Build complete!`, sin warnings de variable `logout` sin usar.

- [ ] **Step 4: Commit**

```bash
git add app/layouts/default.vue
git commit -m "feat: reemplazar bloque de usuario del header por SharedUserMenu"
```

---

## Task 9: Umbral de alertas configurable en `useTareas.ts`

**Files:**
- Modify: `app/composables/useTareas.ts:14,89-97`

**Interfaces:**
- Consumes: `useMiPerfil()` → `perfil` (Task 3), específicamente `perfil.value?.settings?.umbral_alertas_minutos`.

- [ ] **Step 1: Renombrar la constante fija a default y ajustar `refrescarTareasProximas`**

Reemplazar:

```ts
const UMBRAL_MINUTOS_PROXIMAS = 30
```

por:

```ts
const UMBRAL_MINUTOS_DEFAULT = 30
```

Reemplazar el cuerpo de `refrescarTareasProximas` (dentro de `export function useTareas()`):

```ts
  async function refrescarTareasProximas(): Promise<void> {
    const pendientes = await fetchMisTareasPendientes()
    const ahora = Date.now()
    tareasProximas.value = pendientes.filter((t) => {
      if (!t.fecha_vencimiento || idsTareasDescartadas.value.has(t.id)) return false
      const msRestante = new Date(t.fecha_vencimiento).getTime() - ahora
      return msRestante <= UMBRAL_MINUTOS_PROXIMAS * 60_000
    })
```

por:

```ts
  async function refrescarTareasProximas(): Promise<void> {
    const { perfil } = useMiPerfil()
    const valorConfigurado = perfil.value?.settings?.umbral_alertas_minutos
    const umbralMinutos = typeof valorConfigurado === 'number' ? valorConfigurado : UMBRAL_MINUTOS_DEFAULT

    const pendientes = await fetchMisTareasPendientes()
    const ahora = Date.now()
    tareasProximas.value = pendientes.filter((t) => {
      if (!t.fecha_vencimiento || idsTareasDescartadas.value.has(t.id)) return false
      const msRestante = new Date(t.fecha_vencimiento).getTime() - ahora
      return msRestante <= umbralMinutos * 60_000
    })
```

(El resto de la función — poda de `idsTareasDescartadas` — no cambia.)

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: `✨ Build complete!`.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useTareas.ts
git commit -m "feat: leer umbral de alertas desde configuración de usuario"
```

---

## Task 10: Verificación manual end-to-end

**Files:** ninguno (solo verificación, sin cambios de código).

- [ ] **Step 1: Levantar el dev server**

Run: `npm run dev` (dejar corriendo en background)

- [ ] **Step 2: Recorrer los escenarios del spec**

Con sesión iniciada en el navegador:

1. Clickear el nombre en el header → se abre el dropdown con "Perfil", "Configuración", "Salir".
2. Clickear afuera del dropdown → se cierra.
3. Abrir "Perfil" → cambiar el nombre → "Guardar" → el nombre en el header se actualiza sin recargar la página.
4. Abrir "Perfil" → "Cambiar foto" → subir una imagen → el avatar del header cambia a la foto subida.
5. Abrir "Configuración" → cambiar el umbral a 5 minutos → "Guardar". Crear una tarea (en cualquier lead/cliente/ticket) con vencimiento en 4 minutos → esperar hasta 60s → el alert de `RecordatorioAlert` aparece.
6. Clickear "Salir" desde el menú → cierra sesión y redirige a `/login`, igual que antes.

- [ ] **Step 3: Build final**

Run: `npm run build`
Expected: `✨ Build complete!`, sin errores ni warnings nuevos.

- [ ] **Step 4: Confirmar con el usuario**

Reportar el resultado de los 6 escenarios del Step 2 antes de dar la tarea por completa.
