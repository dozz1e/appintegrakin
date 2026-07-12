# Diff de campos en la vista de Auditoría — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el bloque de JSON crudo "Antes"/"Después" en la vista de auditoría por una lista legible de solo los campos que realmente cambiaron.

**Architecture:** Una función pura `calcularDiff()` en un archivo nuevo (`app/utils/auditoriaDiff.ts`, auto-importado por Nuxt) calcula, a partir de `accion`/`datos_anteriores`/`datos_nuevos`, la lista de campos a mostrar con etiquetas en español. La página de auditoría (`app/pages/admin/auditoria/index.vue`) llama a esa función en el template al expandir un registro, reemplazando los dos `<pre>{{ JSON.stringify(...) }}</pre>` actuales.

**Tech Stack:** Nuxt 4 / Vue 3, TypeScript. Sin framework de tests instalado en el proyecto — la verificación de la función pura usa `vite-node` (ya presente en `node_modules/.bin`, viene con Vite) para un script de verificación desechable (no se commitea), más `npm run build` para type-check. La vista se verifica con testing manual en navegador.

## Global Constraints

- No se toca `app/composables/useAuditoria.ts`, la tabla `audit_log`, el trigger `registrar_auditoria()`, ni qué tablas están auditadas.
- Campos siempre excluidos del diff (en insert, update y delete): `id`, `created_at`, `updated_at`, `version`.
- Etiquetas en español vía el mapa `FIELD_LABELS`; si un campo no está en el mapa, se usa el nombre crudo de la columna como respaldo (nunca ocultarlo).
- `owner_id`, `cliente_id`, `created_by` se muestran como UUID crudo, sin resolver a nombre — fuera de alcance.
- Valores vacíos/`null`/`undefined`/`''` se muestran como el texto `(vacío)`.
- Si la lista de campos calculada queda vacía, la vista muestra `Sin cambios visibles en los campos` en vez de una lista vacía sin explicación.
- Usar `node`/`npm` del sistema (no `bun`) para cualquier comando.

---

### Task 1: `app/utils/auditoriaDiff.ts` — función pura `calcularDiff`

**Files:**
- Create: `app/utils/auditoriaDiff.ts`

**Interfaces:**
- Consumes: nada (función pura, sin dependencias externas).
- Produces: `export interface CampoDiff { campo: string; etiqueta: string; anterior?: string; nuevo?: string; valor?: string }` y `export function calcularDiff(accion: 'insert' | 'update' | 'delete', datosAnteriores: Record<string, unknown> | null, datosNuevos: Record<string, unknown> | null): CampoDiff[]`. Task 2 importa `calcularDiff` (Nuxt auto-import, sin `import` explícito necesario dentro de `app/`) y usa exactamente esta firma.

- [ ] **Step 1: Crear el archivo con la implementación completa**

Crear `app/utils/auditoriaDiff.ts` con este contenido exacto:

```ts
const FIELD_LABELS: Record<string, string> = {
  rut: 'RUT',
  razon_social: 'Razón social',
  nombre_contacto: 'Nombre de contacto',
  telefono: 'Teléfono',
  email: 'Email',
  kame_id: 'ID Kame',
  imagen_url: 'Imagen',
  owner_id: 'Responsable',
  created_by: 'Creado por',
  nombre: 'Nombre',
  origen: 'Origen',
  estado: 'Estado',
  cliente_id: 'Cliente',
  titulo: 'Título',
  descripcion: 'Descripción',
  prioridad: 'Prioridad',
}

const CAMPOS_EXCLUIDOS = new Set(['id', 'created_at', 'updated_at', 'version'])

export interface CampoDiff {
  campo: string
  etiqueta: string
  anterior?: string
  nuevo?: string
  valor?: string
}

function etiquetaDe(campo: string): string {
  return FIELD_LABELS[campo] ?? campo
}

function formatearValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '(vacío)'
  return String(valor)
}

export function calcularDiff(
  accion: 'insert' | 'update' | 'delete',
  datosAnteriores: Record<string, unknown> | null,
  datosNuevos: Record<string, unknown> | null
): CampoDiff[] {
  if (accion === 'insert' && datosNuevos) {
    return Object.keys(datosNuevos)
      .filter((campo) => !CAMPOS_EXCLUIDOS.has(campo))
      .map((campo) => ({
        campo,
        etiqueta: etiquetaDe(campo),
        valor: formatearValor(datosNuevos[campo]),
      }))
  }

  if (accion === 'delete' && datosAnteriores) {
    return Object.keys(datosAnteriores)
      .filter((campo) => !CAMPOS_EXCLUIDOS.has(campo))
      .map((campo) => ({
        campo,
        etiqueta: etiquetaDe(campo),
        valor: formatearValor(datosAnteriores[campo]),
      }))
  }

  if (accion === 'update' && datosAnteriores && datosNuevos) {
    const campos = new Set([...Object.keys(datosAnteriores), ...Object.keys(datosNuevos)])
    return [...campos]
      .filter((campo) => !CAMPOS_EXCLUIDOS.has(campo))
      .filter((campo) => formatearValor(datosAnteriores[campo]) !== formatearValor(datosNuevos[campo]))
      .map((campo) => ({
        campo,
        etiqueta: etiquetaDe(campo),
        anterior: formatearValor(datosAnteriores[campo]),
        nuevo: formatearValor(datosNuevos[campo]),
      }))
  }

  return []
}
```

- [ ] **Step 2: Escribir un script de verificación desechable y correrlo con vite-node**

Crear un archivo temporal `/tmp/verificar-auditoria-diff.ts` (fuera del repo, no se commitea) con este contenido:

```ts
import { calcularDiff } from '/run/media/Respaldo/Trabajo/claude/appintegrakin/app/utils/auditoriaDiff'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('FALLÓ: ' + msg)
  console.log('OK: ' + msg)
}

// update: solo campos que cambiaron, excluye metadata
const diffUpdate = calcularDiff(
  'update',
  { telefono: '111', estado: 'nuevo', updated_at: 'a', version: 1 },
  { telefono: '222', estado: 'nuevo', updated_at: 'b', version: 2 }
)
assert(diffUpdate.length === 1, 'update devuelve solo 1 campo (telefono cambió, estado no)')
assert(diffUpdate[0].campo === 'telefono', 'el campo devuelto es telefono')
assert(diffUpdate[0].anterior === '111' && diffUpdate[0].nuevo === '222', 'anterior/nuevo correctos')
assert(diffUpdate[0].etiqueta === 'Teléfono', 'etiqueta mapeada a Teléfono')

// insert: todos los campos de datosNuevos, sin metadata
const diffInsert = calcularDiff('insert', null, { razon_social: 'Clínica Sur', id: 'x', created_at: 'y' })
assert(diffInsert.length === 1, 'insert excluye id y created_at')
assert(diffInsert[0].valor === 'Clínica Sur', 'insert usa .valor, no .anterior/.nuevo')

// delete: todos los campos de datosAnteriores
const diffDelete = calcularDiff('delete', { titulo: 'Ticket X', version: 3 }, null)
assert(diffDelete.length === 1, 'delete excluye version')
assert(diffDelete[0].valor === 'Ticket X', 'delete usa .valor con el dato eliminado')

// vacío/null se formatea como (vacío)
const diffVacio = calcularDiff('update', { telefono: null }, { telefono: '' })
assert(diffVacio.length === 0, 'null y "" se consideran distintos por !== pero ambos formatean a (vacío) si aparecen')

const diffVacio2 = calcularDiff('update', { telefono: null }, { telefono: '123' })
assert(diffVacio2[0].anterior === '(vacío)', 'null se formatea como (vacío)')

// campo sin etiqueta mapeada usa el nombre crudo
const diffSinEtiqueta = calcularDiff('update', { campo_futuro: 'a' }, { campo_futuro: 'b' })
assert(diffSinEtiqueta[0].etiqueta === 'campo_futuro', 'campo sin mapear usa el nombre crudo como etiqueta')

// update donde todo lo que cambió está excluido -> lista vacía
const diffSoloMetadata = calcularDiff(
  'update',
  { telefono: '111', updated_at: 'a', version: 1 },
  { telefono: '111', updated_at: 'b', version: 2 }
)
assert(diffSoloMetadata.length === 0, 'update que solo toca metadata devuelve lista vacía')

console.log('Todas las verificaciones pasaron')
```

- [ ] **Step 3: Ejecutar el script y confirmar que todas las verificaciones pasan**

Run: `npx vite-node /tmp/verificar-auditoria-diff.ts`
Expected: 8 líneas `OK: ...` y al final `Todas las verificaciones pasaron`, sin ninguna línea `FALLÓ`.

Si alguna verificación falla, corregir `app/utils/auditoriaDiff.ts` antes de continuar (no el script de verificación, que ya refleja el comportamiento acordado en la spec).

- [ ] **Step 4: Borrar el script temporal**

Run: `rm /tmp/verificar-auditoria-diff.ts`

- [ ] **Step 5: Verificar que el build del proyecto sigue pasando**

Run: `npm run build`
Expected: build termina sin errores de TypeScript (el archivo nuevo debe tipar correctamente contra `Record<string, unknown> | null`).

- [ ] **Step 6: Commit**

```bash
git add app/utils/auditoriaDiff.ts
git commit -m "$(cat <<'EOF'
Agregar calcularDiff para la vista de auditoría

Función pura que reduce datos_anteriores/datos_nuevos a solo los campos
que cambiaron, con etiquetas en español y exclusión de metadata técnica
(id, created_at, updated_at, version).
EOF
)"
```

---

### Task 2: Reemplazar el JSON crudo en `admin/auditoria/index.vue`

**Files:**
- Modify: `app/pages/admin/auditoria/index.vue:57-66`

**Interfaces:**
- Consumes: `calcularDiff(accion, datosAnteriores, datosNuevos): CampoDiff[]` de `app/utils/auditoriaDiff.ts` (Task 1) — auto-importado, sin `import` explícito. `CampoDiff` tiene `{ campo, etiqueta, anterior?, nuevo?, valor? }`.
- Produces: nada — último task del plan.

- [ ] **Step 1: Reemplazar el bloque expandible**

En `app/pages/admin/auditoria/index.vue`, reemplazar las líneas 57-66:

```html
          <div v-if="expandido === r.id" class="mt-3 grid grid-cols-2 gap-4 text-xs">
            <div v-if="r.datos_anteriores">
              <p class="font-semibold text-gray-400 mb-1">Antes</p>
              <pre class="bg-gray-50 rounded-lg p-2 overflow-x-auto text-gray-600">{{ JSON.stringify(r.datos_anteriores, null, 2) }}</pre>
            </div>
            <div v-if="r.datos_nuevos">
              <p class="font-semibold text-gray-400 mb-1">Después</p>
              <pre class="bg-gray-50 rounded-lg p-2 overflow-x-auto text-gray-600">{{ JSON.stringify(r.datos_nuevos, null, 2) }}</pre>
            </div>
          </div>
```

por:

```html
          <div v-if="expandido === r.id" class="mt-3 text-xs">
            <ul v-if="calcularDiff(r.accion, r.datos_anteriores, r.datos_nuevos).length" class="divide-y divide-gray-50">
              <li
                v-for="d in calcularDiff(r.accion, r.datos_anteriores, r.datos_nuevos)"
                :key="d.campo"
                class="py-1.5 flex items-center gap-2"
              >
                <span class="font-medium text-gray-600 w-40 flex-shrink-0">{{ d.etiqueta }}</span>
                <template v-if="r.accion === 'update'">
                  <span class="text-gray-400">{{ d.anterior }}</span>
                  <Icon name="mdi:arrow-right" class="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  <span class="text-gray-700">{{ d.nuevo }}</span>
                </template>
                <span v-else class="text-gray-700">{{ d.valor }}</span>
              </li>
            </ul>
            <p v-else class="text-gray-400">Sin cambios visibles en los campos</p>
          </div>
```

No se toca ninguna otra parte del archivo (`<script setup>` líneas 1-33 sin cambios: `registros`, `cargando`, `expandido`, `colorAccion`, `labelAccion`, `toggle` siguen igual).

- [ ] **Step 2: Verificar que el build pasa**

Run: `npm run build`
Expected: build termina sin errores de TypeScript/Vue (confirma que `calcularDiff` se resuelve correctamente vía auto-import y que `r.accion`/`r.datos_anteriores`/`r.datos_nuevos` tipan contra la firma de Task 1).

- [ ] **Step 3: Testing manual en navegador**

Con `npm run dev` corriendo, abrir `/admin/auditoria` (requiere permiso `auditoria.view_all`) y verificar contra la spec (`docs/superpowers/specs/2026-07-12-auditoria-diff-campos-design.md`, sección "Testing"):

1. Editar un cliente/lead/ticket cambiando 1-2 campos (ej. teléfono y estado): el registro de auditoría, al expandirse, muestra solo esos campos con "anterior → nuevo" y etiquetas en español — sin `updated_at` ni `version`.
2. Crear un cliente/lead/ticket nuevo: el registro `insert` expandido lista los campos con su valor inicial (sin flecha), también sin metadata técnica.
3. Eliminar un cliente/lead/ticket (si hay permiso): el registro `delete` expandido lista los campos con el valor que tenían al momento de eliminarse.
4. Si es posible provocar un update que solo modifique campos excluidos (o revisar visualmente un caso límite): se muestra "Sin cambios visibles en los campos" en vez de una lista vacía sin explicación.
5. Un campo vacío/null (ej. `telefono` sin valor) se muestra como "(vacío)" y no como texto vacío o "null" crudo.
6. Colapsar y volver a expandir un registro sigue funcionando igual que antes (mismo comportamiento de `toggle`).

Si algún paso falla, corregir antes de continuar al commit.

- [ ] **Step 4: Commit**

```bash
git add app/pages/admin/auditoria/index.vue
git commit -m "$(cat <<'EOF'
Reemplazar JSON crudo por diff de campos en vista de auditoría

El bloque expandible ahora lista solo los campos que cambiaron (update)
o los campos iniciales/eliminados (insert/delete), con etiquetas en
español, en vez de dos bloques de JSON completos difíciles de comparar.
EOF
)"
```
