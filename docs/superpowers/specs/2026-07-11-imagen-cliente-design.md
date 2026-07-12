# Imagen de cliente

## Contexto

Pedido del usuario: agregar la opción de subir una imagen (foto/logo) para
un cliente en `/clientes`.

Estado actual relevante:
- `app/composables/useClientes.ts`: interfaz `Cliente` (sin campo de
  imagen), CRUD sobre la tabla `clientes` vía `useSupabaseClient()`.
- `app/components/clientes/ClienteForm.vue`: formulario controlado
  (`modelValue`/`submit`), campos `razon_social`, `rut`, `nombre_contacto`,
  `telefono`, `email`. Se usa en `app/pages/clientes/nuevo.vue` (crear,
  sin `modelValue`) y `app/pages/clientes/[id].vue` (editar, con
  `modelValue` y guardado via `updateCliente` + optimistic locking por
  `version`).
- `app/components/shared/Avatar.vue` (`SharedAvatar`): iniciales +
  color determinístico por hash de `nombre`, sin soporte de imagen hoy.
  Se usa con clientes en tres lugares: lista izquierda y header del panel
  central de `ClienteSplitView.vue`, y en la fila de resultados/detalle
  de otros lugares del CRM que reciben `nombre` — para este cambio solo
  nos interesan los usos con clientes.
- No existe ningún bucket de Supabase Storage en el proyecto todavía
  (`grep storage` sobre `supabase/migrations/` no devuelve nada) — es la
  primera vez que se usa Storage en esta app.
- `has_permission(p_user uuid, p_resource text, p_action text)` (definida
  en `20260703000000_superadmin_features.sql`, `security definer stable`)
  es la función que ya gatea `clientes_update`/`clientes_insert` etc. en
  RLS de tablas — se reutiliza igual para las políticas del bucket.
- Decisión de UX ya validada con el usuario: la subida/edición de imagen
  vive **solo en el formulario de crear/editar** (`ClienteForm.vue`), no
  en la vista de tarjetas (`ClienteSplitView.vue`, que quedó de solo
  lectura + link "Editar cliente" en el cambio anterior). La imagen se
  **muestra en todos los avatares de cliente** (no solo en el detalle).

## Decisiones de producto (validadas con el usuario)

1. **Dónde se sube:** solo en `ClienteForm.vue` (crear y editar). No se
   agrega upload directo desde `ClienteSplitView.vue`.
2. **Dónde se muestra:** en todos los `SharedAvatar` que reciben datos de
   un cliente — si `imagen_url` existe, se muestra la foto; si no, se
   mantiene el fallback de iniciales actual.
3. **Origen de la imagen:** subida de archivo real a Supabase Storage
   (no un campo de texto para pegar una URL externa).

## Diseño

### 1. Storage: bucket `clientes-imagenes`

Bucket **público** (lectura pública, sin necesidad de signed URLs) — son
fotos/logos de clientes B2B, no datos sensibles, y así el `<img src>` en
el frontend puede apuntar directo a la URL pública sin pasar por el
cliente de Supabase. Escritura restringida por RLS.

Migración nueva `supabase/migrations/20260712000000_imagen_cliente.sql`:

```sql
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

Nota: en `nuevo.vue` el cliente todavía no existe cuando se elige el
archivo, pero la creación (`create` permission) ya implica poder editar
inmediatamente después en el mismo flujo — por eso basta gatear
insert/update/delete de Storage con el permiso `edit` de `clientes`, sin
duplicar la distinción create/edit que sí existe en la tabla `clientes`.
Igual que `has_permission` ya hace en las políticas de tabla, esto no
reimplementa la lógica de "propio vs todos" (`view`/`view_all`) porque
Storage no tiene noción de `owner_id`; cualquiera con permiso de editar
clientes puede reemplazar la imagen de cualquier cliente, consistente con
que hoy cualquiera con `clientes.edit` ya puede editar todos los campos
del cliente si además tiene `view_all` (y los suyos si no).

### 2. `useClientes.ts`

- `Cliente.imagen_url: string | null` agregado a la interfaz.
- Nueva función `subirImagenCliente(clienteId: string, archivo: File)`:
  - Valida en el frontend (antes de llamar, ver §3) tipo (`image/*`) y
    tamaño (máx. 3 MB) — mensajes de error claros vía toast, sin
    depender de que Storage rechace el archivo.
  - Sube a `clientes-imagenes/{clienteId}/{Date.now()}-{archivo.name}`
    (path único por timestamp, evita colisiones y problemas de caché de
    CDN al reemplazar una imagen).
  - `supabase.storage.from('clientes-imagenes').upload(path, archivo)`,
    luego `getPublicUrl(path)` y devuelve la URL pública (string).
  - No borra el archivo anterior (fuera de alcance — ver más abajo).

### 3. `ClienteForm.vue`

Nuevo campo antes de "Razón social":

- Preview circular (reutiliza visualmente el mismo círculo que
  `SharedAvatar`, pero acá es un `<label>` clickeable envolviendo un
  `<input type="file" accept="image/*" class="hidden">`) — muestra la
  imagen actual (`modelValue?.imagen_url`) o un ícono placeholder
  (`mdi:image-outline`) si no hay ninguna.
  - `URL.createObjectURL(archivo)` para preview inmediata al elegir
    archivo, antes de subir nada.
  - Validación inline al seleccionar: si no es `image/*` o pesa más de
    3 MB, se descarta la selección y se muestra un error bajo el campo
    (mismo patrón que `errores.email` ya existente).
- Botón pequeño "Quitar foto" (solo visible si hay imagen actual o
  seleccionada), que limpia la selección/preview y marca un flag interno
  `quitada = true`. No borra el archivo ya subido en Storage — solo deja
  de referenciarlo: al emitir `submit`, si `quitada` es `true` se emite
  `null` como segundo argumento (ver más abajo) para que el padre guarde
  `imagen_url: null` en la tabla.

**Flujo de guardado (`onSubmit`):**

El componente ya no puede subir el archivo él mismo antes de emitir
`submit`, porque en el caso "crear" (`nuevo.vue`) el cliente aún no tiene
`id` — Storage necesita el `clienteId` para el path. Por eso
`ClienteForm` emite el **archivo seleccionado**, no la URL:

- `defineEmits<{ submit: [payload: Partial<Cliente>, archivoImagen?: File | null] }>()`
  — segundo argumento opcional: el `File` elegido, o `null` explícito si
  el usuario quitó una imagen existente, o `undefined` si no se tocó el
  campo.
- El payload (`Partial<Cliente>`) ya NO incluye `imagen_url` — lo resuelve
  el padre después de tener el `id`.

**Cambios en los padres:**

- `nuevo.vue` — `onSubmit(payload, archivoImagen)`: crea el cliente
  primero (`createCliente(payload)`), y si `archivoImagen` es un `File`,
  llama `subirImagenCliente(cliente.id, archivoImagen)` y luego
  `updateCliente(cliente.id, { imagen_url })` antes de navegar a
  `/clientes/${cliente.id}`. Si la subida falla, el cliente ya quedó
  creado igual (se avisa con un toast de error separado, sin bloquear la
  navegación — falla de imagen no debe perder los datos ya guardados).
- `[id].vue` — `onSubmit(payload, archivoImagen)`: si `archivoImagen` es
  `File`, sube y agrega `imagen_url` al `payload` antes de llamar
  `updateCliente` (un solo update, ya que acá sí hay `id` desde el
  principio). Si `archivoImagen === null` (el usuario quitó la foto),
  agrega `imagen_url: null` al payload igual.

### 4. `Avatar.vue`

- Nueva prop opcional `imagenUrl?: string | null`.
- Si `imagenUrl` viene con valor: `<img :src="imagenUrl" class="[mismo
  tamaño/rounded-full que el span actual] object-cover" @error="...">`
  — en `@error` (URL rota) cae a un `ref<boolean>` local que fuerza mostrar
  las iniciales en su lugar, para no dejar el ícono roto del navegador.
- Si no: mismo `<span>` de iniciales que ya existe hoy (sin cambios de
  comportamiento para clientes/leads que no tengan foto).

**Sitios que pasan `imagen-url` (los tres usos con clientes):**
- `ClienteSplitView.vue`: lista izquierda (`size="sm"`) y header del
  panel central (`size="md"`) — ambos con `:imagen-url="c.imagen_url"` /
  `:imagen-url="seleccionado.imagen_url"`.
- `ClienteForm.vue`: el preview del campo nuevo (aunque este usa un
  `<img>` propio, no `SharedAvatar`, porque necesita mostrar la selección
  local antes de guardar — no la URL ya persistida).

## Fuera de alcance

- No se borra el archivo anterior en Storage al reemplazar la imagen de
  un cliente (quedan huérfanos) — requeriría trackear el path completo
  además de la URL pública, o un job de limpieza; YAGNI para esta
  primera versión dado el volumen esperado de clientes.
- No se agrega recorte/edición de imagen (crop, resize) en el navegador
  — se sube el archivo tal cual, solo se valida tipo y tamaño máximo.
- No se agrega upload de imagen en `ClienteSplitView.vue` — decisión
  explícita del usuario, ver Contexto.
- No se tocan `ClienteTable.vue` (ya no existe), `leads`, ni ningún otro
  módulo — el campo `imagen_url` y el bucket son exclusivos de clientes.
- No se genera un placeholder por defecto distinto al ícono actual de
  iniciales (ej. sin avatar genérico tipo "silueta de persona").

## Testing (manual, sin suite automatizada aún)

1. Aplicar la migración y confirmar en el dashboard de Supabase que el
   bucket `clientes-imagenes` existe como público y que `clientes` tiene
   la columna `imagen_url`.
2. Crear un cliente nuevo en `/clientes/nuevo` sin imagen: confirmar que
   se crea igual que antes (sin regresión) y que el avatar muestra
   iniciales en la vista de tarjetas.
3. Crear un cliente nuevo eligiendo una imagen válida (jpg/png, < 3 MB):
   confirmar preview inmediata en el formulario, y que tras guardar la
   imagen aparece en el avatar de la lista izquierda y el header del
   panel central de `ClienteSplitView`.
4. Editar un cliente existente en `/clientes/[id]` y agregarle/cambiarle
   la imagen: confirmar que se actualiza en todos los avatares sin
   recargar la página completa (o tras recargar, según corresponda).
5. Quitar la foto de un cliente que ya tenía una (botón "Quitar foto" +
   guardar): confirmar que vuelve a mostrar iniciales.
6. Intentar seleccionar un archivo no-imagen o mayor a 3 MB: confirmar
   que se muestra el error inline y no se sube nada.
7. Con un usuario sin permiso `clientes.edit`: confirmar que la subida
   falla con un mensaje de error claro (RLS de Storage rechaza el
   insert/update).
8. Confirmar que una URL de imagen rota (ej. borrada manualmente del
   bucket) cae a iniciales en vez de mostrar el ícono roto del navegador.
