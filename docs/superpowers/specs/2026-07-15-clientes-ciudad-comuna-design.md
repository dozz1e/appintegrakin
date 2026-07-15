# Ciudad y comuna de clientes + carga de fichas.xlsx

## Contexto

Llegó un archivo (`fichas.xlsx`, fuera del repo, en un disco externo del
usuario) con 1896 filas: `Rut, Nombre, Dirección, Teléfono, E-mail, Comuna,
Ciudad`. Comparado contra los 1893 clientes ya cargados en el sistema
(`clientes.rut`), el match es prácticamente total: 1893 de 1893 RUT
existentes aparecen en el archivo, y solo 1 fila del archivo no tiene
correspondencia (RUT `1-9`, "CLIENTE BOLETA", el típico cliente genérico
para boletas sin RUT real, sin datos reales en el resto de las columnas).

`ciudad` y `comuna` no existen hoy en la tabla `clientes` (sí existe un
campo `cliente_ciudad_libre`, pero es un campo denormalizado de
`tickets_post_venta`, no relacionado). Se agregan como campos nuevos y
permanentes del cliente, y además se hace una carga única del contenido
del archivo (que no es solo ciudad/comuna — trae también nombre,
dirección, teléfono y email actualizados de cada cliente).

Decisiones tomadas durante el brainstorming:

- Se agregan `ciudad` y `comuna` como columnas permanentes de `clientes`
  (no solo para esta carga puntual) — se exponen en el formulario, la
  ficha de cliente y el CSV general de export/import.
- La carga del archivo es **única, ahora** — no queda como pantalla nueva
  en la app. Si en el futuro llega otro archivo similar, se repite el
  proceso puntualmente.
- El archivo se trata como fuente de verdad para nombre, dirección,
  teléfono, email, comuna y ciudad — **pero solo cuando trae un valor
  real**. Si una celda viene vacía o con `"."` (placeholder usado en el
  archivo), no se pisa el dato que el cliente ya tiene cargado en el
  sistema.
- Todos los campos de texto se normalizan a capitalización estilo
  español al cargarlos (nombre, dirección, comuna, ciudad) — primera
  letra de cada palabra en mayúscula, salvo preposiciones/artículos
  cortos (`de`, `del`, `la`, `las`, `los`, `y`) que quedan en minúscula
  (excepto si son la primera palabra). El email se guarda en minúsculas.
  El RUT no se normaliza (se deja tal cual, solo `trim`) — la DB ya tiene
  RUT con dígito verificador en mayúscula y minúscula mezclados, no es
  parte de este trabajo unificarlo.
- La única fila sin match (`CLIENTE BOLETA`, RUT `1-9`) se crea como
  cliente nuevo, sin `owner_id`/`created_by` (no pertenece a ningún
  vendedor en particular).
- Esta normalización de capitalización es **solo para esta carga**. No
  cambia el comportamiento de `createCliente`/`updateCliente` (carga
  manual futura vía formulario) ni de `importClientes` (import CSV
  general, que además sigue ignorando duplicados por RUT sin
  actualizarlos — comportamiento intencional preexistente, no se toca).

## Diseño

### Migración: columnas nuevas

Mismo patrón que `20260712010000_direccion_cliente.sql`:

```sql
-- supabase/migrations/20260715XXXXXX_ciudad_comuna_cliente.sql
alter table clientes add column ciudad text;
alter table clientes add column comuna text;
```

Nullable, sin default, sin índice (no hay hoy filtro/búsqueda por ciudad
o comuna).

### `useClientes.ts` — interfaz `Cliente`

Se agregan dos campos:

```ts
export interface Cliente {
  // ...campos existentes sin cambios...
  ciudad: string | null
  comuna: string | null
}
```

`createCliente`/`updateCliente` no cambian de firma (siguen aceptando
`Partial<Cliente>`, ya soportan cualquier campo declarado en la
interfaz).

### `ClienteForm.vue`

Se agregan `ciudad` y `comuna` al `reactive` inicial del form:

```ts
const form = reactive<Partial<Cliente>>({
  // ...campos existentes...
  ciudad: props.modelValue?.ciudad ?? '',
  comuna: props.modelValue?.comuna ?? '',
})
```

Y un bloque nuevo en el template, después del bloque de Dirección, mismo
patrón visual que el grid de Teléfono/Email:

```html
<div class="grid grid-cols-2 gap-4">
  <div>
    <label class="block text-sm font-medium mb-1 text-gray-700">Comuna</label>
    <input
      v-model="form.comuna"
      type="text"
      class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
    />
  </div>
  <div>
    <label class="block text-sm font-medium mb-1 text-gray-700">Ciudad</label>
    <input
      v-model="form.ciudad"
      type="text"
      class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
    />
  </div>
</div>
```

### `ClienteSplitView.vue` — ficha de cliente

Se agregan al mismo grid de dos columnas donde ya están RUT, Nombre de
contacto, Teléfono, Email, Dirección — después del bloque Dirección:

```html
<div>
  <p class="text-xs text-gray-400 mb-1">Comuna</p>
  <p class="text-gray-700 capitalize">{{ seleccionado.comuna || '—' }}</p>
</div>
<div>
  <p class="text-xs text-gray-400 mb-1">Ciudad</p>
  <p class="text-gray-700 capitalize">{{ seleccionado.ciudad || '—' }}</p>
</div>
```

(La clase `capitalize` de Tailwind ya se usa así en `direccion` y
`nombre_contacto` en este mismo archivo — es una transformación visual
que no depende de cómo esté guardado el dato, se mantiene por
consistencia aunque los datos de esta carga ya vengan normalizados.)

### `index.vue` (listado de clientes) — export/import CSV general

`onExportar` agrega las dos columnas:

```ts
function onExportar() {
  const filas = clientes.value.map((c) => ({
    rut: c.rut ?? '',
    razon_social: c.razon_social,
    nombre_contacto: c.nombre_contacto ?? '',
    telefono: c.telefono ?? '',
    email: c.email ?? '',
    direccion: c.direccion ?? '',
    ciudad: c.ciudad ?? '',
    comuna: c.comuna ?? '',
  }))
  descargarCSV('clientes', filas)
}
```

`importClientes` (en `useClientes.ts`) agrega el mapeo de las dos
columnas al armar `candidatos`, mismo criterio que `direccion` (opcional,
`trim() || null`):

```ts
.map((f) => ({
  // ...campos existentes...
  ciudad: f.ciudad?.trim() || null,
  comuna: f.comuna?.trim() || null,
}))
```

Este cambio es solo el mapeo de columnas — el resto del comportamiento de
`importClientes` (upsert con `ignoreDuplicates: true`, es decir salta
RUT que ya existen sin actualizarlos) no cambia.

### Carga única de `fichas.xlsx`

Ejecutada directamente por el asistente contra la base de datos de
producción (vía `mcp__supabase__execute_sql`), no por un subagente ni
desde la UI — es una operación puntual sobre datos reales, con el
archivo ya inspeccionado y parseado (convertido a CSV con `libreoffice
--headless --convert-to csv`, 1896 filas, columnas `Rut, Nombre,
Dirección, Teléfono, E-mail, Comuna, Ciudad`, todas con 7 campos válidos
tras parseo CSV correcto — RFC4180, comillas manejan las comas dentro de
direcciones).

Transformaciones antes de cargar:

```ts
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y'])

function capitalizarEs(texto: string): string {
  return texto
    .trim()
    .toLocaleLowerCase('es')
    .split(/\s+/)
    .map((palabra, i) =>
      i > 0 && MINUSCULAS.has(palabra)
        ? palabra
        : palabra.charAt(0).toLocaleUpperCase('es') + palabra.slice(1)
    )
    .join(' ')
}

function valorOVacio(campo: string): string | null {
  const t = campo.trim()
  return t === '' || t === '.' ? null : t
}
```

- `Nombre` → `razon_social`: `capitalizarEs`.
- `Dirección` → `direccion`: `capitalizarEs`.
- `Comuna` → `comuna`: `capitalizarEs`.
- `Ciudad` → `ciudad`: `capitalizarEs`.
- `Teléfono` → `telefono`: solo `trim` (no es texto capitalizable).
- `E-mail` → `email`: `.trim().toLocaleLowerCase('es')`.
- `Rut`: solo `trim`, sin cambio de capitalización.

Todas pasan primero por `valorOVacio` — si el resultado es `null`
(celda vacía o `"."`), ese campo no se incluye en el `UPDATE` para esa
fila (se preserva el valor existente en `clientes`).

Para los 2 RUT duplicados dentro del archivo (`76.811.538-9`,
`16.435.364-8`), se usa la **última** ocurrencia de cada uno (la fila más
abajo en el archivo) como valor final antes de aplicar el merge contra la
base.

Mecánica de carga (por cada una de las 1894 filas únicas, tras aplicar
capitalización y `valorOVacio`):
- `UPDATE clientes SET <campos con valor real> WHERE rut = <rut de la fila>` —
  si el RUT matchea (1893 de 1894 filas).
- `INSERT INTO clientes (rut, razon_social, direccion, telefono, email,
  comuna, ciudad, owner_id, created_by) VALUES (...)` con `owner_id` y
  `created_by` en `NULL` — para el único RUT sin match (`1-9`, CLIENTE
  BOLETA; sus demás campos ya vienen vacíos en el archivo, así que el
  insert queda con solo `rut` y `razon_social`).

Verificación antes/después con SQL: conteo de clientes con `ciudad`/
`comuna` no nulos antes (0) y después (≈1894), conteo total de clientes
antes (1893) y después (1894), muestra de 5-10 filas comparando archivo
vs. base tras la carga.

## Fuera de alcance

- No se agrega búsqueda/filtro por ciudad o comuna en `/clientes` ni en
  `buscarClientes` — solo se guardan y muestran.
- No se normaliza el dígito verificador del RUT (mayúscula/minúscula) —
  ya está mezclado en la base hoy, no es parte de este trabajo.
- No se cambia el comportamiento de `importClientes` para duplicados
  (sigue sin actualizar RUT existentes vía el import general de la UI) —
  la actualización masiva de este archivo es un proceso aparte, no una
  funcionalidad de la app.
- No se fuerza capitalización en `createCliente`/`updateCliente` para
  carga manual futura vía formulario — el usuario puede seguir tipeando
  como quiera.
- Sin dropdown/lista fija de comunas de Chile — campos de texto libre,
  igual criterio que `direccion`.

## Testing (manual, sin suite automatizada)

1. Migración aplicada: `clientes.ciudad` y `clientes.comuna` existen,
   nullable, sin afectar filas existentes (quedan en `NULL` hasta la
   carga).
2. Crear un cliente nuevo desde `/clientes/nuevo` con ciudad y comuna
   cargadas → se guardan y se ven en la ficha (`ClienteSplitView.vue`).
3. Editar un cliente existente, agregar/cambiar ciudad y comuna → se
   actualizan correctamente (optimistic locking sigue funcionando, no se
   toca `updateCliente`).
4. Exportar CSV desde `/clientes` → el archivo incluye columnas `ciudad`
   y `comuna` con los valores actuales.
5. Importar un CSV con columnas `ciudad`/`comuna` para clientes nuevos
   (RUT que no existen) → se crean con esos valores.
6. Tras la carga única: conteo de clientes con `ciudad` o `comuna` no
   nulos ≈ 1894 (de 1894 clientes totales tras la carga).
7. Tomar 5 clientes al azar de antes de la carga que ya tenían, por
   ejemplo, `telefono` cargado, y verificar que si el archivo traía esa
   celda vacía o `"."`, el `telefono` en la base sigue igual (no se
   perdió).
8. Verificar el cliente `CLIENTE BOLETA` (RUT `1-9`) existe tras la
   carga, con `owner_id` y `created_by` en `NULL`.
9. Verificar capitalización en una muestra: nombres en mayúscula sostenida
   en el archivo (ej. "ABIGAIL SUSANA LEAL LLANQUIMAN") quedan como
   "Abigail Susana Leal Llanquiman"; direcciones con "de"/"la" quedan en
   minúscula salvo al inicio; emails quedan en minúsculas aunque el
   archivo los traiga en mayúscula.
