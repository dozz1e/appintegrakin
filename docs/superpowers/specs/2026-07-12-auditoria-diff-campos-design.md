# Diff de campos en la vista de Auditoría

## Contexto

Pedido del usuario: la vista de auditoría (`app/pages/admin/auditoria/index.vue`)
hoy muestra, al expandir un registro, dos bloques de JSON crudo
("Antes"/"Después") con la fila completa de la tabla afectada. Es difícil
comparar a ojo qué campo cambió realmente. Se pide reemplazarlo por un diff
real que muestre solo los campos que cambiaron.

Estado actual relevante:
- `app/composables/useAuditoria.ts`: `fetchAuditoria(limite = 100)` trae
  registros de `audit_log` (`tabla`, `registro_id`, `usuario_id`, `accion:
  'insert'|'update'|'delete'`, `datos_anteriores: jsonb|null`,
  `datos_nuevos: jsonb|null`, `created_at`, `usuario`). No se toca este
  composable ni la tabla `audit_log` ni el trigger `registrar_auditoria()`
  (`supabase/migrations/20260702000800_audit_log.sql`) — son la fuente de
  datos, ya suficientes para calcular el diff en el frontend.
- El trigger de auditoría solo está enganchado a `clientes`, `leads` y
  `tickets` (`supabase/migrations/20260702000200_clientes_leads_tickets.sql`,
  `.../20260707010000_optimistic_locking.sql`,
  `.../20260712000000_imagen_cliente.sql`). Columnas actuales de esas 3
  tablas (unión, para el mapa de etiquetas):
  - Comunes: `id`, `owner_id`, `created_by`, `created_at`, `updated_at`,
    `version` (agregada por `optimistic_locking`).
  - `clientes`: `rut`, `razon_social`, `nombre_contacto`, `telefono`,
    `email`, `kame_id`, `imagen_url` (agregada por `imagen_cliente`).
  - `leads`: `nombre`, `telefono`, `email`, `origen`, `estado`,
    `cliente_id`.
  - `tickets`: `cliente_id`, `titulo`, `descripcion`, `estado`,
    `prioridad`.
  - Todas las columnas son escalares (`text`, `uuid`, `timestamptz`,
    `integer`) — no hay JSON anidado ni arrays que diffear.
- `app/pages/admin/auditoria/index.vue`: página con toggle de expandir por
  fila (`expandido = ref<string | null>(null)`, `toggle(id)`); el bloque a
  reemplazar es el `<div v-if="expandido === r.id" class="grid grid-cols-2
  gap-4 text-xs">` con los dos `<pre>{{ JSON.stringify(...) }}</pre>`
  (líneas 57-66 en el archivo actual).

## Decisiones de producto (validadas con el usuario)

1. **Excluir campos de metadata técnica del diff:** `id`, `created_at`,
   `updated_at`, `version` nunca aparecen en la lista de campos mostrados
   (ni en update, ni en insert, ni en delete) — no son cambios de negocio
   y `updated_at`/`version` cambian en absolutamente todos los updates,
   serían ruido constante.
2. **Etiquetas legibles en español**, no nombres crudos de columna: un
   mapa fijo `campo → etiqueta` (ej. `razon_social` → "Razón social",
   `telefono` → "Teléfono", `estado` → "Estado"). Si aparece una columna
   sin mapear (ej. una columna nueva agregada después), se usa el nombre
   crudo de la columna como respaldo — no debe romper ni ocultar el campo.
3. **IDs relacionados (`owner_id`, `cliente_id`, `created_by`) se muestran
   como UUID crudo**, sin resolver a nombre (sin joins ni fetches
   adicionales de perfiles/clientes en esta vista) — YAGNI para esta
   primera versión.
4. **`insert` y `delete` también usan el nuevo formato de lista de
   campos** (no diff de dos columnas, ya que no hay "antes" o "después"
   real): `insert` lista los campos de `datos_nuevos` con su valor
   inicial; `delete` lista los campos de `datos_anteriores` con el valor
   que tenían al momento de eliminarse. Mismo mapa de etiquetas y misma
   exclusión de campos de metadata que en `update`.

## Diseño

### `app/utils/auditoriaDiff.ts` (nuevo)

Lógica pura, sin dependencias de Supabase ni de Vue reactivo (Nuxt
auto-importa `app/utils/**` sin necesidad de import explícito en los
componentes).

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

Nota: la comparación usa los valores ya formateados con `formatearValor`
(no los valores crudos) para que `null`, `undefined` y `''` se traten
como equivalentes — evita mostrar un campo como "cambiado" cuando ambos
lados se ven igual ("(vacío)" en los dos). Funciona sin ambigüedad porque
todas las columnas de las 3 tablas auditadas son escalares (texto, uuid,
timestamptz, integer) — no hay que serializar ni comparar objetos
anidados.

### `app/pages/admin/auditoria/index.vue`

Reemplazar el bloque expandible (líneas 57-66 del archivo actual):

```html
<template v-for="diff in expandido === r.id ? [calcularDiff(r.accion, r.datos_anteriores, r.datos_nuevos)] : []" :key="`${r.id}-diff`">
  <div class="mt-3 text-xs">
    <ul v-if="diff.length" class="divide-y divide-gray-50">
      <li
        v-for="d in diff"
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
</template>
```

`calcularDiff` viene de `app/utils/auditoriaDiff.ts` (auto-importado). Se
envuelve en un array de un elemento con `v-for` (patrón común en Vue para
"let" en templates) para calcularlo una sola vez por fila expandida, en
vez de una vez por cada `v-if`/`v-for` que lo referencie.

`Icon name="mdi:arrow-right"` sigue el mismo patrón ya usado en
`LeadTimeline.vue` (`@nuxt/icon`, íconos `mdi:*`).

## Fuera de alcance

- No se toca `useAuditoria.ts`, la tabla `audit_log`, el trigger
  `registrar_auditoria()`, ni qué tablas están auditadas (solo
  clientes/leads/tickets, igual que hoy).
- No se resuelven `owner_id`/`cliente_id`/`created_by` a nombres legibles
  — quedan como UUID crudo.
- No se agregan filtros (por usuario, tabla, acción, fecha) ni paginación
  real más allá del límite fijo de 100 — fuera del pedido actual, que es
  específicamente el diff de campos.
- No se cambia el resto de la página (badge de acción, cabecera con
  usuario/tabla, timestamp del registro, el toggle expandir/colapsar).

## Testing (manual, sin suite automatizada aún)

1. Editar un cliente/lead/ticket cambiando 1-2 campos (ej. teléfono y
   estado) y confirmar que el registro de auditoría correspondiente,
   al expandirse, muestra solo esos campos con "anterior → nuevo" y
   etiquetas en español — sin `updated_at` ni `version` en la lista.
2. Crear un cliente/lead/ticket nuevo y confirmar que su registro de
   auditoría (`insert`) expandido lista los campos con su valor inicial
   (sin flecha), también sin metadata técnica.
3. Eliminar un cliente/lead/ticket (si hay permiso) y confirmar que el
   registro `delete` expandido lista los campos con el valor que tenían
   al momento de eliminarse.
4. Provocar un update que solo modifique campos excluidos si es posible
   (o revisar visualmente un caso límite) y confirmar que se muestra
   "Sin cambios visibles en los campos" en vez de una lista vacía sin
   explicación.
5. Confirmar que un campo vacío/null (ej. `telefono` sin valor) se
   muestra como "(vacío)" y no como texto vacío o "null" crudo.
6. Confirmar que colapsar y volver a expandir un registro sigue
   funcionando igual que hoy (mismo comportamiento de `toggle`).
