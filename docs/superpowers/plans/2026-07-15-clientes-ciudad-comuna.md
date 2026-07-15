# Ciudad y comuna de clientes + carga de fichas.xlsx — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar `ciudad`/`comuna` como campos permanentes de `clientes` (schema + formulario + ficha + CSV general), y cargar una vez el contenido de `fichas.xlsx` (1896 filas, ya inspeccionado y parseado) actualizando los 1893 clientes existentes que matchean por RUT y creando el único que no matchea.

**Architecture:** Migración simple de dos columnas nullable (mismo patrón que `direccion_cliente.sql`). UI: tres archivos existentes (`useClientes.ts`, `ClienteForm.vue`, `ClienteSplitView.vue`, `index.vue`) ganan dos campos más, sin cambiar ninguna firma de función existente. La carga de datos es una operación puntual fuera de este flujo de tareas — no es código de la app, la ejecuta el controller directamente contra la base con SQL generado a partir del archivo ya parseado.

**Tech Stack:** Nuxt 4 / Vue 3, Supabase (Postgres) — mismo stack, sin librerías nuevas.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-15-clientes-ciudad-comuna-design.md`.
- `ciudad`/`comuna`: `text`, nullable, sin default, sin índice.
- Sin cambios de firma en `createCliente`/`updateCliente`/`importClientes` — siguen aceptando `Partial<Cliente>` / el mapeo de columnas existente, solo se agregan dos campos al tipo y al mapeo.
- Sin dropdown de comunas — campos de texto libre, igual que `direccion`.
- No hay suite de tests automatizada (sin vitest/jest). Verificación: `rm -rf .nuxt && npm run build` + revisión manual en navegador.
- **Task 3 (carga de datos) no se ejecuta via subagente** — es una operación puntual sobre datos de producción reales derivados de un archivo fuera del repo (`/run/media/Respaldo/Oz/Escritorio/fichas.xlsx`), ya inspeccionada y parseada por el controller en esta misma sesión. La ejecuta el controller directamente. Se documenta acá para que quede registro de lo que se hizo, no para que un implementador la repita.

---

### Task 1: Migración — columnas `ciudad`/`comuna`

**Files:**
- Create: `supabase/migrations/20260715230000_ciudad_comuna_cliente.sql`

**Interfaces:**
- Produces: columnas `clientes.ciudad text`, `clientes.comuna text`, ambas nullable.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260715230000_ciudad_comuna_cliente.sql

alter table clientes add column ciudad text;
alter table clientes add column comuna text;
```

- [ ] **Step 2: Aplicar la migración**

Usar `mcp__supabase__apply_migration` con el contenido de arriba (nombre: `ciudad_comuna_cliente`), o el flujo de migraciones que use el proyecto. Verificar con SQL:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'clientes' and column_name in ('ciudad', 'comuna');
```

Expected: 2 filas, `data_type = text`, `is_nullable = YES`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260715230000_ciudad_comuna_cliente.sql
git commit -m "feat: agregar columnas ciudad y comuna a clientes"
```

---

### Task 2: Formulario, ficha, export/import CSV

**Files:**
- Modify: `app/composables/useClientes.ts`
- Modify: `app/components/clientes/ClienteForm.vue`
- Modify: `app/components/clientes/ClienteSplitView.vue`
- Modify: `app/pages/clientes/index.vue`

**Interfaces:**
- Consumes: columnas `ciudad`/`comuna` de Task 1 (ya aplicadas en la base).
- Produces: `Cliente.ciudad: string | null`, `Cliente.comuna: string | null` — usados por `ClienteForm.vue`, `ClienteSplitView.vue`, `index.vue`.

- [ ] **Step 1: Agregar los campos a la interfaz `Cliente`**

En `app/composables/useClientes.ts`, en la interfaz `Cliente` (busca `imagen_url: string | null`), agregar después de `direccion`:

```ts
export interface Cliente {
  id: string
  rut: string | null
  razon_social: string
  nombre_contacto: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  ciudad: string | null
  comuna: string | null
  imagen_url: string | null
  kame_id: string | null
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
}
```

- [ ] **Step 2: Agregar `ciudad`/`comuna` al mapeo de `importClientes`**

En la misma función `importClientes`, dentro del `.map((f) => ({ ... }))` que arma `candidatos`, agregar después de `direccion: f.direccion?.trim() || null,`:

```ts
        ciudad: f.ciudad?.trim() || null,
        comuna: f.comuna?.trim() || null,
```

- [ ] **Step 3: Verificar que compila**

Run: `rm -rf .nuxt && npm run build`
Expected: build sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/composables/useClientes.ts
git commit -m "feat: agregar ciudad/comuna a la interfaz Cliente y al import CSV"
```

- [ ] **Step 5: Agregar los campos al formulario**

En `app/components/clientes/ClienteForm.vue`, en el `reactive` `form` (busca `direccion: props.modelValue?.direccion ?? '',`), agregar después:

```ts
  ciudad: props.modelValue?.ciudad ?? '',
  comuna: props.modelValue?.comuna ?? '',
```

En el template, después del bloque:

```html
    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Dirección</label>
      <input
        v-model="form.direccion"
        type="text"
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
    </div>
```

agregar:

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

- [ ] **Step 6: Mostrar los campos en la ficha de cliente**

En `app/components/clientes/ClienteSplitView.vue`, dentro del grid de dos columnas (busca `<p class="text-xs text-gray-400 mb-1">Dirección</p>`), después de ese bloque (`col-span-2` de Dirección):

```html
            <div class="col-span-2">
              <p class="text-xs text-gray-400 mb-1">Dirección</p>
              <p class="text-gray-700 capitalize">{{ seleccionado.direccion || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Comuna</p>
              <p class="text-gray-700 capitalize">{{ seleccionado.comuna || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Ciudad</p>
              <p class="text-gray-700 capitalize">{{ seleccionado.ciudad || '—' }}</p>
            </div>
```

(Reemplaza el bloque de Dirección existente agregando los dos `div` nuevos inmediatamente después, dentro del mismo `grid grid-cols-2 gap-4 text-sm`.)

- [ ] **Step 7: Agregar los campos al export CSV**

En `app/pages/clientes/index.vue`, en `onExportar`, dentro del `.map((c) => ({ ... }))`, agregar después de `direccion: c.direccion ?? '',`:

```ts
    ciudad: c.ciudad ?? '',
    comuna: c.comuna ?? '',
```

- [ ] **Step 8: Verificar que compila**

Run: `rm -rf .nuxt && npm run build`
Expected: build sin errores.

- [ ] **Step 9: Reiniciar dev server y verificar en navegador**

Run: `rm -rf .nuxt && npm run dev`

En `/clientes/nuevo`: crear un cliente con ciudad y comuna, guardar, abrir su ficha (`ClienteSplitView.vue` o `/clientes/[id]`) y confirmar que se ven. Editar el cliente, cambiar ciudad/comuna, confirmar que persiste. Exportar CSV desde `/clientes` y confirmar que las columnas `ciudad`/`comuna` están presentes con los valores correctos.

- [ ] **Step 10: Commit**

```bash
git add app/components/clientes/ClienteForm.vue app/components/clientes/ClienteSplitView.vue app/pages/clientes/index.vue
git commit -m "feat: mostrar y editar ciudad/comuna en formulario, ficha y export CSV de clientes"
```

---

### Task 3: Carga única de `fichas.xlsx` (ejecutada por el controller, no por subagente)

**No dispatch a subagente.** Ver Global Constraints. Documentado acá para registro.

**Insumos ya preparados en esta sesión:**
- Archivo original: `/run/media/Respaldo/Oz/Escritorio/fichas.xlsx`.
- Convertido a CSV: `libreoffice --headless --convert-to csv "/run/media/Respaldo/Oz/Escritorio/fichas.xlsx"` (ejecutar desde un directorio de trabajo temporal — el archivo `fichas.csv` se genera ahí).
- 1896 filas de datos, columnas `Rut, Nombre, Dirección, Teléfono, E-mail, Comuna, Ciudad`, las 1896 con 7 campos válidos (parseo CSV con librería que respete comillas — `csv` de Python o `Papa.parse`, no `awk -F,`).
- Diff contra la base ya calculado: 1893 RUT matchean exactamente con `clientes.rut`, 1 no matchea (`1-9`, "CLIENTE BOLETA", sin otros datos reales), 0 clientes en la base quedan fuera del archivo.
- 2 RUT duplicados dentro del archivo (`76.811.538-9`, `16.435.364-8`) — usar la última ocurrencia de cada uno.

- [ ] **Step 1: Escribir y correr el script de transformación + carga**

Script (Node o Python, ejecutar localmente — no requiere commit al repo, es una herramienta de un solo uso):

1. Parsear el CSV con una librería que respete comillas RFC4180.
2. Para RUT duplicados, quedarse con la última fila del archivo por RUT.
3. Aplicar por fila:
   - `capitalizarEs` (ver spec, sección "Carga única de fichas.xlsx") a `Nombre`→`razon_social`, `Dirección`→`direccion`, `Comuna`→`comuna`, `Ciudad`→`ciudad`.
   - `.trim()` a `Rut` y `Teléfono`→`telefono`, sin cambio de capitalización.
   - `.trim().toLocaleLowerCase('es')` a `E-mail`→`email`.
   - Tratar celda vacía o `"."` como ausente (no se incluye ese campo en el `UPDATE`) en cualquiera de las columnas anteriores.
4. Generar SQL: para cada RUT que matchea contra `clientes`, un `UPDATE clientes SET <solo campos con valor> WHERE rut = '<rut>'`; para el único RUT sin match, un `INSERT INTO clientes (rut, razon_social, owner_id, created_by) VALUES ('1-9', 'Cliente Boleta', NULL, NULL)` (sus otros campos vienen vacíos en el archivo, no hay nada más que insertar).
5. Ejecutar el SQL generado vía `mcp__supabase__execute_sql`, en lotes si el statement es demasiado grande para una sola llamada.

- [ ] **Step 2: Verificar el resultado**

```sql
select count(*) as total, count(ciudad) as con_ciudad, count(comuna) as con_comuna from clientes;
```
Expected: `total = 1894`, `con_ciudad` y `con_comuna` ≈ 1894 (menos los pocos casos donde el archivo traía "." o vacío en esa columna específica para ese cliente).

```sql
select rut, razon_social, direccion, telefono, email, comuna, ciudad
from clientes where rut = '1-9';
```
Expected: 1 fila, "Cliente Boleta", resto de campos en `NULL`.

Tomar 5 RUT al azar del archivo y comparar contra `clientes` — confirmar capitalización correcta y que ningún campo que ya tenía dato bueno en la base quedó vacío.

- [ ] **Step 3: Reportar al usuario**

Resumen de cuántos clientes se actualizaron, cuántos se crearon, y confirmación de que el build sigue limpio (no debería verse afectado, es solo datos). No requiere commit de código — la migración de Task 1 ya está commiteada; esta carga es solo datos en la base.
