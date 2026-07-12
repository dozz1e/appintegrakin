# Filtros y paginación en la vista de Auditoría — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el límite fijo de 100 registros en la vista de auditoría por filtros (usuario, tabla, acción, rango de fechas) y paginación real server-side con botón "Cargar más".

**Architecture:** `useAuditoria.ts` gana una nueva firma de `fetchAuditoria(filtros, pagina)` que arma la query de Supabase dinámicamente (`.eq()`/`.gte()`/`.lte()` condicionales + `.range()`) y devuelve `{ registros, hasMore }`. La página consume esa firma: una fila de filtros siempre visible dispara una recarga completa al cambiar, y un botón "Cargar más" acumula páginas siguientes.

**Tech Stack:** Nuxt 4 / Vue 3, TypeScript, Supabase JS client. Sin framework de tests instalado — verificación vía `npm run build` (type-check) y testing manual en navegador (la query depende de `useSupabaseClient()`, que requiere runtime de Nuxt, así que no se puede probar de forma aislada con `vite-node` como en la task anterior de `auditoriaDiff.ts`).

## Global Constraints

- Paginación con botón "Cargar más" (no páginas numeradas), bloques de 30 registros (`TAMANO_PAGINA = 30`).
- Filtros siempre visibles arriba de la lista, nunca colapsables.
- Rango de fechas: dos campos `type="date"` independientes ("Desde"/"Hasta"), ambos opcionales.
- Filtrado y paginación 100% server-side (Supabase), nunca client-side sobre un batch ya traído.
- Tabla filtrable: lista fija en el frontend (`clientes`, `leads`, `tickets`) — no una consulta a la base de datos.
- No se sincronizan filtros con la URL, no hay exportar a CSV, no hay presets de fecha rápidos — fuera de alcance.
- No se toca `app/utils/auditoriaDiff.ts` ni el bloque de diff ya implementado dentro de cada fila.
- Usar `node`/`npm` del sistema (no `bun`) para cualquier comando.

---

### Task 1: `useAuditoria.ts` — filtros y paginación real

**Files:**
- Modify: `app/composables/useAuditoria.ts` (archivo completo, reemplaza el contenido actual)

**Interfaces:**
- Consumes: nada nuevo (usa `useSupabaseClient()`, ya usado en la versión actual del archivo).
- Produces: `export interface AuditoriaFiltros { usuarioId?: string; tabla?: string; accion?: 'insert' | 'update' | 'delete'; desde?: string; hasta?: string }` y `fetchAuditoria(filtros: AuditoriaFiltros = {}, pagina = 0): Promise<{ registros: AuditoriaEntry[]; hasMore: boolean }>`. Task 2 importa `AuditoriaFiltros` y llama `fetchAuditoria` con esta firma exacta — la firma anterior (`fetchAuditoria(limite = 100): Promise<AuditoriaEntry[]>`) desaparece por completo, no queda como alias ni sobrecarga.

- [ ] **Step 1: Reemplazar el archivo completo**

Reemplazar todo el contenido de `app/composables/useAuditoria.ts` por:

```ts
// composables/useAuditoria.ts

export interface AuditoriaEntry {
  id: string
  tabla: string
  registro_id: string
  usuario_id: string | null
  accion: 'insert' | 'update' | 'delete'
  datos_anteriores: Record<string, unknown> | null
  datos_nuevos: Record<string, unknown> | null
  created_at: string
  usuario?: { full_name: string | null; email: string | null } | null
}

export interface AuditoriaFiltros {
  usuarioId?: string
  tabla?: string
  accion?: 'insert' | 'update' | 'delete'
  desde?: string  // 'YYYY-MM-DD'
  hasta?: string  // 'YYYY-MM-DD'
}

const TAMANO_PAGINA = 30

export const useAuditoria = () => {
  const supabase = useSupabaseClient()

  const fetchAuditoria = async (filtros: AuditoriaFiltros = {}, pagina = 0) => {
    let query = supabase
      .from('audit_log')
      .select('*, usuario:profiles!audit_log_usuario_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })

    if (filtros.usuarioId) query = query.eq('usuario_id', filtros.usuarioId)
    if (filtros.tabla) query = query.eq('tabla', filtros.tabla)
    if (filtros.accion) query = query.eq('accion', filtros.accion)
    if (filtros.desde) query = query.gte('created_at', `${filtros.desde}T00:00:00`)
    if (filtros.hasta) query = query.lte('created_at', `${filtros.hasta}T23:59:59`)

    const inicio = pagina * TAMANO_PAGINA
    const fin = inicio + TAMANO_PAGINA
    const { data, error } = await query.range(inicio, fin)
    if (error) throw error

    const filas = data as unknown as AuditoriaEntry[]
    const hasMore = filas.length > TAMANO_PAGINA
    return { registros: hasMore ? filas.slice(0, TAMANO_PAGINA) : filas, hasMore }
  }

  return { fetchAuditoria }
}
```

- [ ] **Step 2: Verificar que el build pasa**

Run: `npm run build`
Expected: build termina sin errores de TypeScript. Nota: `app/pages/admin/auditoria/index.vue` todavía llama a la firma vieja (`fetchAuditoria()` sin argumentos) hasta que se complete Task 2 — **esto va a producir un error de tipos esperado** en ese archivo (la firma nueva no acepta cero argumentos de la misma forma que la vieja, y el código que consume el resultado como array en vez de `{ registros, hasMore }` fallará). Confirmar que el único error de build es en `app/pages/admin/auditoria/index.vue` (relacionado con la firma de `fetchAuditoria`) y no en `app/composables/useAuditoria.ts` — un error ahí sería un problema real de este task. Si el build falla únicamente por ese archivo, es el resultado esperado hasta Task 2; documentarlo en el reporte y continuar.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useAuditoria.ts
git commit -m "$(cat <<'EOF'
Agregar filtros y paginación real a fetchAuditoria

fetchAuditoria(limite) se reemplaza por fetchAuditoria(filtros, pagina),
que arma la query de Supabase con filtros opcionales (usuario, tabla,
acción, rango de fechas) y pagina con .range() en bloques de 30,
devolviendo { registros, hasMore }.
EOF
)"
```

---

### Task 2: Filtros y "Cargar más" en `admin/auditoria/index.vue`

**Files:**
- Modify: `app/pages/admin/auditoria/index.vue` (archivo completo, reemplaza el contenido actual)

**Interfaces:**
- Consumes: `AuditoriaEntry`, `AuditoriaFiltros` de `app/composables/useAuditoria.ts` (Task 1); `fetchAuditoria(filtros: AuditoriaFiltros, pagina: number): Promise<{ registros: AuditoriaEntry[]; hasMore: boolean }>` (Task 1); `Usuario` de `app/composables/useUsuarios.ts` (ya existente, sin cambios); `fetchUsuarios(): Promise<Usuario[]>` (ya existente, sin cambios); `calcularDiff` de `app/utils/auditoriaDiff.ts` (ya existente, sin cambios — auto-importado).
- Produces: nada — último task del plan.

- [ ] **Step 1: Reemplazar el archivo completo**

Reemplazar todo el contenido de `app/pages/admin/auditoria/index.vue` por:

```html
<script setup lang="ts">
import type { AuditoriaEntry, AuditoriaFiltros } from '~/composables/useAuditoria'
import type { Usuario } from '~/composables/useUsuarios'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'auditoria', actions: ['view_all'] },
})

const { fetchAuditoria } = useAuditoria()
const { fetchUsuarios } = useUsuarios()

const registros = ref<AuditoriaEntry[]>([])
const usuarios = ref<Usuario[]>([])
const cargando = ref(true)
const cargandoMas = ref(false)
const hasMore = ref(false)
const pagina = ref(0)
const expandido = ref<string | null>(null)

const filtroUsuario = ref('')
const filtroTabla = ref('')
const filtroAccion = ref<'' | 'insert' | 'update' | 'delete'>('')
const filtroDesde = ref('')
const filtroHasta = ref('')

const filtrosActivos = computed(
  () => !!(filtroUsuario.value || filtroTabla.value || filtroAccion.value || filtroDesde.value || filtroHasta.value)
)

function construirFiltros(): AuditoriaFiltros {
  return {
    usuarioId: filtroUsuario.value || undefined,
    tabla: filtroTabla.value || undefined,
    accion: filtroAccion.value || undefined,
    desde: filtroDesde.value || undefined,
    hasta: filtroHasta.value || undefined,
  }
}

async function cargarPrimeraPagina() {
  cargando.value = true
  pagina.value = 0
  const resultado = await fetchAuditoria(construirFiltros(), 0)
  registros.value = resultado.registros
  hasMore.value = resultado.hasMore
  cargando.value = false
}

async function cargarMas() {
  cargandoMas.value = true
  pagina.value += 1
  const resultado = await fetchAuditoria(construirFiltros(), pagina.value)
  registros.value = [...registros.value, ...resultado.registros]
  hasMore.value = resultado.hasMore
  cargandoMas.value = false
}

onMounted(async () => {
  usuarios.value = await fetchUsuarios()
  await cargarPrimeraPagina()
})

watch([filtroUsuario, filtroTabla, filtroAccion, filtroDesde, filtroHasta], cargarPrimeraPagina)

const colorAccion: Record<string, string> = {
  insert: 'bg-green-50 text-green-700',
  update: 'bg-[#EAF4FA] text-[#0C5D91]',
  delete: 'bg-red-50 text-red-700',
}

const labelAccion: Record<string, string> = {
  insert: 'Creó',
  update: 'Editó',
  delete: 'Eliminó',
}

const toggle = (id: string) => {
  expandido.value = expandido.value === id ? null : id
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Auditoría" />

    <div class="flex flex-wrap gap-2 mb-4">
      <select v-model="filtroUsuario" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30">
        <option value="">Todos los usuarios</option>
        <option v-for="u in usuarios" :key="u.id" :value="u.id">{{ u.full_name || u.email }}</option>
      </select>

      <select v-model="filtroTabla" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30">
        <option value="">Todas las tablas</option>
        <option value="clientes">Clientes</option>
        <option value="leads">Leads</option>
        <option value="tickets">Tickets</option>
      </select>

      <select v-model="filtroAccion" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30">
        <option value="">Todas las acciones</option>
        <option value="insert">Creó</option>
        <option value="update">Editó</option>
        <option value="delete">Eliminó</option>
      </select>

      <input
        v-model="filtroDesde"
        type="date"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
      />
      <input
        v-model="filtroHasta"
        type="date"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
      />
    </div>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>

    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="registros.length === 0" class="p-10 text-center text-gray-400">
        {{ filtrosActivos ? 'Sin resultados para estos filtros' : 'Sin actividad registrada todavía' }}
      </div>
      <ul v-else class="divide-y divide-gray-50">
        <li v-for="r in registros" :key="r.id" class="p-4">
          <div class="flex items-center justify-between cursor-pointer" @click="toggle(r.id)">
            <div class="flex items-center gap-3">
              <SharedBadge :label="labelAccion[r.accion]" :clases="colorAccion[r.accion]" />
              <span class="text-sm text-gray-700">
                <span class="font-medium">{{ r.usuario?.full_name || r.usuario?.email || 'Sistema' }}</span>
                en <span class="text-gray-500">{{ r.tabla }}</span>
              </span>
            </div>
            <span class="text-xs text-gray-400">{{ new Date(r.created_at).toLocaleString('es-CL') }}</span>
          </div>

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
        </li>
      </ul>

      <div v-if="hasMore" class="p-4 text-center border-t border-gray-50">
        <button
          :disabled="cargandoMas"
          class="text-sm text-[#1075B5] hover:underline font-medium disabled:opacity-50"
          @click="cargarMas"
        >
          {{ cargandoMas ? 'Cargando...' : 'Cargar más' }}
        </button>
      </div>
    </div>
  </div>
</template>
```

Nota: este bloque preserva exactamente el bloque de diff ya implementado
(commit `a57f830`) sin ningún cambio — solo se agregó la fila de
filtros, el estado de filtros/paginación en el script, y el botón
"Cargar más" al final de la lista.

- [ ] **Step 2: Verificar que el build pasa**

Run: `npm run build`
Expected: build termina sin errores de TypeScript/Vue. Este es el punto donde el error esperado de Task 1 (firma vieja de `fetchAuditoria` en este archivo) debe desaparecer — si sigue habiendo errores de tipos relacionados con `fetchAuditoria`, `AuditoriaFiltros` o el resultado `{ registros, hasMore }`, corregirlos antes de continuar.

- [ ] **Step 3: Testing manual en navegador**

Con `npm run dev` corriendo (verificar si ya hay uno corriendo con `ps aux | grep "npm run dev"` antes de levantar uno nuevo — este proyecto ha tenido problemas con múltiples instancias del dev server compitiendo por el puerto), abrir `/admin/auditoria` (requiere permiso `auditoria.view_all`) y verificar contra la spec (`docs/superpowers/specs/2026-07-12-auditoria-filtros-paginacion-design.md`, sección "Testing"):

1. Sin ningún filtro activo: la lista carga los primeros 30 registros más recientes; si hay más de 30 en total, aparece el botón "Cargar más" al final.
2. Click en "Cargar más": se agregan los siguientes 30 registros al final de la lista (sin duplicar ni perder los ya cargados); el botón desaparece cuando ya no quedan más.
3. Filtrar por una tabla específica (ej. "Leads"): la lista se reemplaza (no se acumula) mostrando solo registros de esa tabla, y la paginación se reinicia.
4. Filtrar por acción ("Eliminó"): solo aparecen registros `delete`.
5. Filtrar por usuario: solo aparecen registros de ese usuario.
6. Filtrar por rango de fechas (solo "Desde", solo "Hasta", y ambos): los registros fuera del rango no aparecen.
7. Combinar 2+ filtros a la vez (ej. tabla + rango de fechas): el resultado respeta todos los filtros combinados (AND, no OR).
8. Aplicar un filtro sin resultados: aparece "Sin resultados para estos filtros" (no "Sin actividad registrada todavía").
9. Quitar todos los filtros (volver a "Todos"/vacío): la lista vuelve a mostrar los registros más recientes sin filtrar.
10. Expandir una fila (el diff de campos ya implementado): sigue funcionando igual con la lista filtrada/paginada.

Si algún paso falla, corregir antes de continuar al commit.

- [ ] **Step 4: Commit**

```bash
git add app/pages/admin/auditoria/index.vue
git commit -m "$(cat <<'EOF'
Agregar filtros y "Cargar más" a la vista de auditoría

Fila de filtros (usuario, tabla, acción, rango de fechas) siempre
visible arriba de la lista; cualquier cambio reinicia la paginación.
Botón "Cargar más" al final acumula el siguiente bloque de 30 registros.
EOF
)"
```
