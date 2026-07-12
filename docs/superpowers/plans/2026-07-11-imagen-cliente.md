# Imagen de Cliente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir subir una foto/logo por cliente en `/clientes`, guardarla en Supabase Storage, y mostrarla en todos los avatares de cliente en vez de las iniciales.

**Architecture:** Bucket público `clientes-imagenes` en Supabase Storage con RLS que reutiliza `has_permission(..., 'clientes', 'edit')`; columna `imagen_url` en `clientes`; `Avatar.vue` gana soporte de imagen con fallback a iniciales; la subida ocurre solo en `ClienteForm.vue` (crear/editar), que emite el `File` seleccionado además del payload de texto para que el padre (`nuevo.vue` / `[id].vue`) lo suba una vez que existe el `id` del cliente.

**Tech Stack:** Nuxt 3 (Vue 3 `<script setup>`, auto-imports de `ref`/`computed`/`watch`), Supabase (Postgres + Storage + `@nuxtjs/supabase` vía `useSupabaseClient()`), Tailwind CSS, `@nuxt/icon` (`mdi:*`).

## Global Constraints

- Bucket de Storage: `clientes-imagenes`, público en lectura, sin signed URLs.
- RLS de escritura del bucket: `has_permission(auth.uid(), 'clientes', 'edit')` en insert/update/delete — mismo criterio que ya usa `clientes_update` en `20260702000300_rls_policies.sql`, sin distinguir `owner_id` (Storage no tiene esa noción).
- Validación de archivo: solo `image/*`, máximo 3 MB — se valida en el frontend (`ClienteForm.vue`) antes de subir, no se depende de que Storage rechace el archivo.
- La subida/edición de imagen vive **solo** en `ClienteForm.vue` (crear y editar). No se agrega upload desde `ClienteSplitView.vue`.
- La imagen se muestra en **todos** los `SharedAvatar` que reciben un cliente. Sin imagen, se mantiene el fallback de iniciales actual sin cambios.
- No se borra el archivo anterior en Storage al reemplazar/quitar una imagen (huérfanos aceptados, fuera de alcance).
- No se agrega crop/resize en el navegador.
- Las migraciones de este proyecto se aplican directo al único proyecto Supabase real (no hay branching disponible). Aplicar una migración es un cambio en producción: pausar y confirmar con el usuario antes de aplicarla.
- No hay suite de tests automatizada en este repo (ni frontend ni backend). La verificación es manual: SQL estructural vía `mcp__supabase__execute_sql` para la migración, y checklist de navegador (`npm run dev`) para los cambios de UI.
- Sin comentarios explicativos en el código salvo que documenten un porqué no obvio (ver el resto del repo como referencia de tono).

---

### Task 1: Migración — bucket de Storage, columna `imagen_url` y políticas RLS

**Files:**
- Create: `supabase/migrations/20260712000000_imagen_cliente.sql`

**Interfaces:**
- Consumes: función `has_permission(p_user uuid, p_resource text, p_action text) returns boolean` (ya existente en `20260703000000_superadmin_features.sql`, `security definer stable`).
- Produces: bucket `clientes-imagenes` (público), columna `clientes.imagen_url text`, políticas `clientes_imagenes_select/insert/update/delete` sobre `storage.objects`. Las Tasks 2 y 3 dependen del nombre exacto del bucket (`clientes-imagenes`) y de la columna (`imagen_url`).

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/20260712000000_imagen_cliente.sql
--
-- Bucket público porque son fotos/logos de clientes B2B, no datos
-- sensibles — permite servir la imagen con <img src> directo a la URL
-- pública sin pasar por el cliente de Supabase. La escritura queda
-- gateada por el mismo permiso que ya protege UPDATE de la fila
-- (clientes.edit), sin reimplementar la distinción propio/todos
-- (view/view_all) porque storage.objects no tiene noción de owner_id.

insert into storage.buckets (id, name, public)
values ('clientes-imagenes', 'clientes-imagenes', true)
on conflict (id) do nothing;

create policy clientes_imagenes_select on storage.objects
for select using (bucket_id = 'clientes-imagenes');

create policy clientes_imagenes_insert on storage.objects
for insert with check (
  bucket_id = 'clientes-imagenes'
  and has_permission(auth.uid(), 'clientes', 'edit')
);

create policy clientes_imagenes_update on storage.objects
for update using (
  bucket_id = 'clientes-imagenes'
  and has_permission(auth.uid(), 'clientes', 'edit')
);

create policy clientes_imagenes_delete on storage.objects
for delete using (
  bucket_id = 'clientes-imagenes'
  and has_permission(auth.uid(), 'clientes', 'edit')
);

alter table clientes add column imagen_url text;
```

- [ ] **Step 2: Pausar y confirmar con el usuario antes de aplicar**

Este proyecto no tiene branching de Supabase disponible (ya verificado en un
plan anterior) — aplicar la migración escribe directo sobre el único
proyecto real. Mostrar el contenido del Step 1 al usuario y esperar
confirmación explícita antes de continuar al Step 3.

- [ ] **Step 3: Aplicar la migración**

Usar la tool `mcp__supabase__apply_migration` con `name: "imagen_cliente"`
y `query` = el contenido completo del Step 1.

- [ ] **Step 4: Verificar estructura con `mcp__supabase__execute_sql`**

```sql
select id, public from storage.buckets where id = 'clientes-imagenes';

select column_name, data_type from information_schema.columns
where table_name = 'clientes' and column_name = 'imagen_url';

select policyname from pg_policies
where schemaname = 'storage' and tablename = 'objects'
and policyname like 'clientes_imagenes%'
order by policyname;
```

Expected:
- Primera query: 1 fila, `public = true`.
- Segunda query: 1 fila, `data_type = 'text'`.
- Tercera query: 4 filas (`clientes_imagenes_delete`, `clientes_imagenes_insert`, `clientes_imagenes_select`, `clientes_imagenes_update`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260712000000_imagen_cliente.sql
git commit -m "$(cat <<'EOF'
Agregar bucket de Storage e imagen_url para clientes

Bucket público clientes-imagenes con RLS de escritura gateada por
has_permission(..., 'clientes', 'edit'), igual que ya protege el UPDATE
de la fila. Prepara el terreno para subir/mostrar fotos de cliente.
EOF
)"
```

---

### Task 2: Mostrar la imagen en los avatares de cliente

**Files:**
- Modify: `app/composables/useClientes.ts`
- Modify: `app/components/shared/Avatar.vue`
- Modify: `app/components/clientes/ClienteSplitView.vue`

**Interfaces:**
- Consumes: columna `clientes.imagen_url` (Task 1).
- Produces: `Cliente.imagen_url: string | null` en la interfaz (usado por Task 3 y por cualquier consumidor de `useClientes()`); prop `Avatar.vue` → `imagenUrl?: string | null` (kebab-case en templates: `:imagen-url`), consumida por cualquier `SharedAvatar` que reciba datos de cliente.

- [ ] **Step 1: Agregar `imagen_url` a la interfaz `Cliente`**

En `app/composables/useClientes.ts`, la interfaz actual es:

```ts
export interface Cliente {
  id: string
  rut: string | null
  razon_social: string
  nombre_contacto: string | null
  telefono: string | null
  email: string | null
  kame_id: string | null
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
}
```

Reemplazar por:

```ts
export interface Cliente {
  id: string
  rut: string | null
  razon_social: string
  nombre_contacto: string | null
  telefono: string | null
  email: string | null
  imagen_url: string | null
  kame_id: string | null
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
}
```

- [ ] **Step 2: Agregar soporte de imagen a `Avatar.vue`**

Reemplazar el contenido completo de `app/components/shared/Avatar.vue`:

```vue
<script setup lang="ts">
const props = defineProps<{ nombre: string; size?: 'sm' | 'md'; imagenUrl?: string | null }>()

const errorImagen = ref(false)

watch(
  () => props.imagenUrl,
  () => {
    errorImagen.value = false
  }
)

const paleta = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
]

const iniciales = computed(() => {
  const partes = props.nombre.trim().split(/\s+/)
  const letras = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '')
  return letras.join('') || '?'
})

const colorClase = computed(() => {
  const hash = props.nombre.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return paleta[hash % paleta.length]
})

const tamano = computed(() => (props.size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'))
</script>

<template>
  <img
    v-if="imagenUrl && !errorImagen"
    :src="imagenUrl"
    :alt="nombre"
    class="inline-block rounded-full object-cover shrink-0"
    :class="tamano"
    @error="errorImagen = true"
  />
  <span
    v-else
    class="inline-flex items-center justify-center rounded-full font-medium shrink-0"
    :class="[colorClase, tamano]"
  >
    {{ iniciales }}
  </span>
</template>
```

- [ ] **Step 3: Pasar `imagen-url` desde `ClienteSplitView.vue`**

En `app/components/clientes/ClienteSplitView.vue`, línea 62:

```vue
          <SharedAvatar :nombre="c.razon_social" size="sm" />
```

reemplazar por:

```vue
          <SharedAvatar :nombre="c.razon_social" :imagen-url="c.imagen_url" size="sm" />
```

Y línea 83:

```vue
            <SharedAvatar :nombre="seleccionado.razon_social" size="md" />
```

reemplazar por:

```vue
            <SharedAvatar :nombre="seleccionado.razon_social" :imagen-url="seleccionado.imagen_url" size="md" />
```

- [ ] **Step 4: Levantar el dev server**

```bash
npm run dev
```

- [ ] **Step 5: Checklist manual — mostrar y hacer fallback de imagen**

Con el dev server corriendo y sesión logueada con permiso `clientes.view`/`view_all`:

1. Tomar el `id` de un cliente existente en `/clientes` (clic para
   seleccionarlo, o consultar `select id from clientes limit 1` vía
   `mcp__supabase__execute_sql`).
2. Setear una imagen de prueba con
   `mcp__supabase__execute_sql`:
   ```sql
   update clientes set imagen_url = 'https://placehold.co/128x128.png' where id = '<id-del-cliente>';
   ```
3. Recargar `/clientes` y confirmar que ese cliente muestra la imagen (no
   iniciales) tanto en la lista izquierda como en el header del panel
   central al seleccionarlo.
4. Setear una URL rota:
   ```sql
   update clientes set imagen_url = 'https://example.invalid/no-existe.png' where id = '<id-del-cliente>';
   ```
   Recargar y confirmar que cae a mostrar iniciales (sin ícono de imagen
   rota del navegador).
5. Volver la columna a `null`:
   ```sql
   update clientes set imagen_url = null where id = '<id-del-cliente>';
   ```
   Recargar y confirmar que vuelve a mostrar iniciales como antes del
   cambio (sin regresión para clientes sin foto).

- [ ] **Step 6: Commit**

```bash
git add app/composables/useClientes.ts app/components/shared/Avatar.vue app/components/clientes/ClienteSplitView.vue
git commit -m "$(cat <<'EOF'
Mostrar imagen_url en los avatares de cliente

Avatar.vue muestra la foto si imagen_url viene con valor (con fallback
a iniciales si la URL falla al cargar); ClienteSplitView pasa el campo
en los dos SharedAvatar que renderizan datos de cliente.
EOF
)"
```

---

### Task 3: Subir, reemplazar y quitar la foto desde `ClienteForm`

**Files:**
- Modify: `app/composables/useClientes.ts`
- Modify: `app/components/clientes/ClienteForm.vue`
- Modify: `app/pages/clientes/nuevo.vue`
- Modify: `app/pages/clientes/[id].vue`

**Interfaces:**
- Consumes: `Cliente.imagen_url` y bucket `clientes-imagenes` (Tasks 1-2).
- Produces: `useClientes().subirImagenCliente(clienteId: string, archivo: File): Promise<string>` (sube y devuelve la URL pública); `ClienteForm` emite `submit: [payload: Partial<Cliente>, archivoImagen?: File | null]` en vez de `submit: [payload: Partial<Cliente>]` — `archivoImagen` es `File` (nueva selección), `null` (el usuario quitó la foto existente) o `undefined` (no se tocó el campo). Nada de esto es consumido fuera de este plan.

- [ ] **Step 1: Agregar `subirImagenCliente` a `useClientes.ts`**

En `app/composables/useClientes.ts`, agregar la función después de
`importClientes` (antes del `return` final):

```ts
  const subirImagenCliente = async (clienteId: string, archivo: File) => {
    const path = `${clienteId}/${Date.now()}-${archivo.name}`
    const { error } = await supabase.storage.from('clientes-imagenes').upload(path, archivo)
    if (error) throw error

    const { data } = supabase.storage.from('clientes-imagenes').getPublicUrl(path)
    return data.publicUrl
  }
```

Y actualizar el `return` (línea 105 actual):

```ts
  return { fetchClientes, getCliente, createCliente, updateCliente, deleteCliente, importClientes }
```

por:

```ts
  return { fetchClientes, getCliente, createCliente, updateCliente, deleteCliente, importClientes, subirImagenCliente }
```

- [ ] **Step 2: Agregar el campo de imagen a `ClienteForm.vue`**

Reemplazar el contenido completo de `app/components/clientes/ClienteForm.vue`:

```vue
<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'

const props = defineProps<{ modelValue?: Partial<Cliente>; cargando?: boolean }>()
const emit = defineEmits<{ submit: [payload: Partial<Cliente>, archivoImagen?: File | null] }>()

const form = reactive<Partial<Cliente>>({
  rut: props.modelValue?.rut ?? '',
  razon_social: props.modelValue?.razon_social ?? '',
  nombre_contacto: props.modelValue?.nombre_contacto ?? '',
  telefono: props.modelValue?.telefono ?? '',
  email: props.modelValue?.email ?? '',
})

const errores = reactive<Record<string, string>>({})

const TAMANO_MAXIMO_BYTES = 3 * 1024 * 1024
const inputImagen = ref<HTMLInputElement | null>(null)
const previewImagen = ref<string | null>(props.modelValue?.imagen_url ?? null)
const archivoImagen = ref<File | null>(null)
const imagenQuitada = ref(false)
const errorImagen = ref('')

function onSeleccionarImagen(e: Event) {
  const archivo = (e.target as HTMLInputElement).files?.[0]
  if (!archivo) return

  if (!archivo.type.startsWith('image/')) {
    errorImagen.value = 'El archivo debe ser una imagen'
    return
  }
  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    errorImagen.value = 'La imagen no puede pesar más de 3 MB'
    return
  }

  errorImagen.value = ''
  imagenQuitada.value = false
  archivoImagen.value = archivo
  previewImagen.value = URL.createObjectURL(archivo)
}

function onQuitarImagen() {
  archivoImagen.value = null
  previewImagen.value = null
  errorImagen.value = ''
  imagenQuitada.value = true
  if (inputImagen.value) inputImagen.value.value = ''
}

const validar = () => {
  errores.razon_social = form.razon_social ? '' : 'La razón social es obligatoria'
  errores.email = form.email && !/^\S+@\S+\.\S+$/.test(form.email) ? 'Email inválido' : ''
  return !Object.values(errores).some(Boolean)
}

const onSubmit = () => {
  if (!validar()) return
  const archivo = archivoImagen.value ?? (imagenQuitada.value ? null : undefined)
  emit('submit', { ...form }, archivo)
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Foto</label>
      <div class="flex items-center gap-3">
        <label
          class="w-16 h-16 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer shrink-0 hover:bg-gray-100 transition-colors"
        >
          <img v-if="previewImagen" :src="previewImagen" alt="Foto del cliente" class="w-full h-full object-cover" />
          <Icon v-else name="mdi:image-outline" class="w-6 h-6 text-gray-300" />
          <input ref="inputImagen" type="file" accept="image/*" class="hidden" @change="onSeleccionarImagen" />
        </label>
        <button
          v-if="previewImagen"
          type="button"
          class="text-sm text-red-600 hover:underline font-medium"
          @click="onQuitarImagen"
        >
          Quitar foto
        </button>
      </div>
      <p v-if="errorImagen" class="text-sm text-red-600 mt-1">{{ errorImagen }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Razón social *</label>
      <input
        v-model="form.razon_social"
        type="text"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
      <p v-if="errores.razon_social" class="text-sm text-red-600 mt-1">{{ errores.razon_social }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">RUT</label>
      <input
        v-model="form.rut"
        type="text"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Nombre de contacto</label>
      <input
        v-model="form.nombre_contacto"
        type="text"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Teléfono</label>
        <input
          v-model="form.telefono"
          type="text"
          class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
        />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Email</label>
        <input
          v-model="form.email"
          type="email"
          class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
        />
        <p v-if="errores.email" class="text-sm text-red-600 mt-1">{{ errores.email }}</p>
      </div>
    </div>

    <button
      type="submit"
      :disabled="cargando"
      class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {{ cargando ? 'Guardando...' : 'Guardar cliente' }}
    </button>
  </form>
</template>
```

- [ ] **Step 3: Actualizar `nuevo.vue` para subir la imagen después de crear**

Reemplazar el contenido completo de `app/pages/clientes/nuevo.vue`:

```vue
<script setup lang="ts">
definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'clientes', actions: ['create'] },
})

const { createCliente, updateCliente, subirImagenCliente } = useClientes()
const router = useRouter()
const { success, error } = useToast()
const cargando = ref(false)

const onSubmit = async (payload: Record<string, unknown>, archivoImagen?: File | null) => {
  cargando.value = true
  try {
    const cliente = await createCliente(payload)
    success('Cliente creado correctamente')

    if (archivoImagen) {
      try {
        const imagen_url = await subirImagenCliente(cliente.id, archivoImagen)
        await updateCliente(cliente.id, { imagen_url })
      } catch (e) {
        error('Cliente creado, pero no se pudo subir la imagen. Puedes intentarlo de nuevo editando el cliente.')
      }
    }

    await router.push(`/clientes/${cliente.id}`)
  } catch (e) {
    error('No se pudo crear el cliente. Intenta de nuevo.')
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-lg">
    <SharedPageHeader titulo="Nuevo cliente" volver-a="/clientes" />
    <SharedCard>
      <ClientesClienteForm :cargando="cargando" @submit="onSubmit" />
    </SharedCard>
  </div>
</template>
```

- [ ] **Step 4: Actualizar `[id].vue` para subir/quitar la imagen al editar**

En `app/pages/clientes/[id].vue`, la línea 11 actual es:

```ts
const { getCliente, updateCliente, deleteCliente } = useClientes()
```

reemplazar por:

```ts
const { getCliente, updateCliente, deleteCliente, subirImagenCliente } = useClientes()
```

El `onSubmit` actual (líneas 31-47) es:

```ts
const onSubmit = async (payload: Record<string, unknown>) => {
  if (!cliente.value) return
  guardando.value = true
  try {
    cliente.value = await updateCliente(cliente.value.id, payload, cliente.value.version)
    success('Cliente actualizado')
  } catch (e: any) {
    if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este cliente mientras lo tenías abierto. Se recargaron los datos actuales, revisa e intenta de nuevo.')
      cliente.value = await getCliente(route.params.id as string)
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  } finally {
    guardando.value = false
  }
}
```

Reemplazar por:

```ts
const onSubmit = async (payload: Record<string, unknown>, archivoImagen?: File | null) => {
  if (!cliente.value) return
  guardando.value = true
  try {
    let payloadFinal = payload
    if (archivoImagen) {
      const imagen_url = await subirImagenCliente(cliente.value.id, archivoImagen)
      payloadFinal = { ...payload, imagen_url }
    } else if (archivoImagen === null) {
      payloadFinal = { ...payload, imagen_url: null }
    }

    cliente.value = await updateCliente(cliente.value.id, payloadFinal, cliente.value.version)
    success('Cliente actualizado')
  } catch (e: any) {
    if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este cliente mientras lo tenías abierto. Se recargaron los datos actuales, revisa e intenta de nuevo.')
      cliente.value = await getCliente(route.params.id as string)
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  } finally {
    guardando.value = false
  }
}
```

Y la línea del template (línea 78 actual):

```vue
          @submit="can('clientes', 'edit') ? onSubmit($event) : undefined"
```

reemplazar por (el handler inline necesita capturar los dos argumentos
emitidos, no solo `$event`, que en Vue 3 solo referencia el primero):

```vue
          @submit="(payload, archivoImagen) => (can('clientes', 'edit') ? onSubmit(payload, archivoImagen) : undefined)"
```

- [ ] **Step 5: Levantar el dev server**

```bash
rm -rf .nuxt
npm run dev
```

- [ ] **Step 6: Checklist manual — flujo completo de subida**

Con sesión logueada con permiso `clientes.create` y `clientes.edit`:

1. Ir a `/clientes/nuevo`, completar razón social, y elegir una imagen
   válida (jpg/png, menor a 3 MB) en el campo "Foto": confirmar que se ve
   la preview circular inmediatamente (antes de guardar).
2. Guardar. Confirmar que redirige a `/clientes/<id>` y que el formulario
   ahí ya muestra la foto guardada (recargar la página si hace falta para
   confirmar que persistió).
3. En esa misma página `/clientes/[id]`, cambiar la foto por otra imagen
   válida y guardar: confirmar que se actualiza.
4. Ir a `/clientes`, seleccionar ese cliente en la vista de tarjetas:
   confirmar que la foto nueva aparece en la lista izquierda y el header
   del panel central (verifica que Task 2 y Task 3 quedaron conectadas).
5. Volver a `/clientes/[id]`, click en "Quitar foto" y guardar: confirmar
   que el campo vuelve a mostrar el ícono placeholder, y que en
   `/clientes` ese cliente vuelve a mostrar iniciales.
6. Intentar seleccionar un archivo `.pdf` o una imagen de más de 3 MB:
   confirmar que aparece el mensaje de error correspondiente bajo el
   campo y que no se dispara ninguna subida (revisar en Network que no
   hay request a Storage).
7. Crear un cliente nuevo SIN elegir imagen: confirmar que se crea
   normalmente y muestra iniciales (sin regresión del flujo sin foto).
8. Con un usuario que NO tenga permiso `clientes.edit` (pero sí
   `clientes.view`/`view_all`): confirmar que al intentar guardar una
   imagen nueva en `/clientes/[id]` la subida falla con el toast de error
   (RLS de Storage rechaza el insert), sin romper el resto de la página.

- [ ] **Step 7: Commit**

```bash
git add app/composables/useClientes.ts app/components/clientes/ClienteForm.vue app/pages/clientes/nuevo.vue app/pages/clientes/[id].vue
git commit -m "$(cat <<'EOF'
Agregar subida de imagen de cliente en ClienteForm

ClienteForm gana un campo de foto (preview, validación de tipo/tamaño,
opción de quitar) y emite el File elegido junto al payload. nuevo.vue
sube la imagen después de crear el cliente (necesita el id); [id].vue
la sube antes de actualizar. subirImagenCliente() en useClientes.ts
sube a Storage y devuelve la URL pública.
EOF
)"
```

---

## Self-Review

**Cobertura del spec:**
- Bucket público + RLS con `has_permission(..., 'clientes', 'edit')` → Task 1. ✓
- Columna `imagen_url` → Task 1. ✓
- `subirImagenCliente` en `useClientes.ts` → Task 3, Step 1. ✓
- Campo de imagen en `ClienteForm.vue` (preview, validación 3 MB/`image/*`, quitar foto) → Task 3, Step 2. ✓
- `ClienteForm` emite el archivo, no la URL (por el caso "crear" sin `id` todavía) → Task 3, Step 2 (`defineEmits`) y Step 3/4 (`nuevo.vue`/`[id].vue`). ✓
- `Avatar.vue` con fallback a iniciales si la imagen falla → Task 2, Step 2. ✓
- Mostrar en todos los avatares de cliente (lista + header de `ClienteSplitView`) → Task 2, Step 3. ✓
- Subida solo desde `ClienteForm`, no desde `ClienteSplitView` → respetado (Task 2 no toca la subida, solo la muestra). ✓
- Testing manual del spec (8 casos) → cubierto por los checklists de Task 1 Step 4, Task 2 Step 5, Task 3 Step 6 en conjunto. ✓

**Placeholders:** ninguno — todos los steps tienen código completo o comandos exactos.

**Consistencia de tipos:** `Cliente.imagen_url: string | null` (Task 2) se usa igual en `ClienteForm.vue` (`props.modelValue?.imagen_url`), `Avatar.vue` (`imagenUrl?: string | null`) y en los payloads de `nuevo.vue`/`[id].vue` (`{ imagen_url }` / `{ imagen_url: null }`). `subirImagenCliente(clienteId: string, archivo: File): Promise<string>` (Task 3, Step 1) coincide con las llamadas en `nuevo.vue` y `[id].vue` (Task 3, Steps 3-4). `emit('submit', payload, archivo)` (Task 3, Step 2) coincide con la firma `defineEmits<{ submit: [payload: Partial<Cliente>, archivoImagen?: File | null] }>()` y con los handlers `onSubmit(payload, archivoImagen)` de ambas páginas.
