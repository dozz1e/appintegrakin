# Filtros y paginación en la vista de Auditoría

## Contexto

Segundo pedido del usuario sobre la vista de auditoría (el primero, el
diff de campos, ya está implementado y en producción — ver
`docs/superpowers/specs/2026-07-12-auditoria-diff-campos-design.md`).
Hoy `fetchAuditoria(limite = 100)` siempre trae los últimos 100 registros
sin forma de filtrar ni de ver más allá de ese límite fijo. Se pide
agregar filtros básicos (usuario, tabla, acción, rango de fechas) y
paginación real.

Estado actual relevante:
- `app/composables/useAuditoria.ts`: `fetchAuditoria(limite = 100):
  Promise<AuditoriaEntry[]>` — un solo `.limit(limite)`, sin filtros, sin
  info de "hay más registros". `AuditoriaEntry` ya expone `usuario_id`,
  `tabla`, `accion: 'insert'|'update'|'delete'`, `created_at`.
- `app/pages/admin/auditoria/index.vue`: `onMounted` llama
  `fetchAuditoria()` una vez, guarda todo en `registros = ref<AuditoriaEntry[]>([])`.
  El resto de la página (badge de acción, toggle de expandir con el diff
  de campos ya implementado) no cambia.
- `app/composables/useUsuarios.ts`: `fetchUsuarios(): Promise<Usuario[]>`
  trae todos los usuarios activos (`profiles` con `active = true`,
  ordenados por `full_name`) — se reutiliza tal cual para poblar el
  selector de usuario, sin tocar este composable.
- Las tablas auditadas son fijas: `clientes`, `leads`, `tickets` (trigger
  `registrar_auditoria()` en `supabase/migrations/20260702000800_audit_log.sql`,
  solo enganchado a esas 3 tablas) — el selector de tabla usa esta lista
  fija, no una consulta a la base de datos.
- Patrón existente de `<input type="date">` en el proyecto:
  `app/components/shared/TareaList.vue:93-96` — mismas clases Tailwind
  (`border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none
  focus:ring-2 focus:ring-[#1075B5]/30`) que se reutilizan aquí para
  consistencia visual con selects e inputs de fecha.

## Decisiones de producto (validadas con el usuario)

1. **Paginación con botón "Cargar más"**, no páginas numeradas. Cada
   carga trae un bloque de registros y los agrega al final de la lista.
2. **Filtros siempre visibles** en una fila arriba de la lista (no
   colapsables detrás de un botón).
3. **Rango de fechas con dos campos "Desde"/"Hasta"** (`type="date"`),
   ambos opcionales de forma independiente — no presets rápidos (hoy/7
   días/30 días).
4. **Filtrado y paginación 100% server-side** (consulta a Supabase con
   `.eq()`/`.gte()`/`.lte()`/`.range()`), no client-side sobre un batch ya
   traído — es la única forma real de eliminar el límite fijo de 100 sin
   traer potencialmente miles de registros al navegador.

## Diseño

### `app/composables/useAuditoria.ts`

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
    const fin = inicio + TAMANO_PAGINA // un registro extra para saber si hay más
    const { data, error } = await query.range(inicio, fin)
    if (error) throw error

    const filas = data as unknown as AuditoriaEntry[]
    const hasMore = filas.length > TAMANO_PAGINA
    return { registros: hasMore ? filas.slice(0, TAMANO_PAGINA) : filas, hasMore }
  }

  return { fetchAuditoria }
}
```

Nota: `.range(inicio, fin)` es inclusivo en ambos extremos en Supabase,
por eso `fin = inicio + TAMANO_PAGINA` (no `- 1`) trae exactamente un
registro de más cuando existe — así se sabe si hay más sin una query de
`count` separada (más cara).

### `app/pages/admin/auditoria/index.vue`

**Script:**

```ts
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
```

**Template** — se agrega la fila de filtros antes de la lista, y el
botón "Cargar más" después. El resto del template (fila de cada
registro, el bloque de diff ya implementado) no cambia:

```html
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
          <!-- fila existente sin cambios (badge, usuario, tabla, fecha, bloque de diff) -->
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

## Fuera de alcance

- No se sincronizan los filtros con la URL (query params) — no son
  compartibles/bookmarkeables en esta primera versión.
- No hay exportar a CSV ni presets de fecha rápidos (hoy/7 días/30 días).
- No se toca `app/utils/auditoriaDiff.ts` ni el bloque de diff ya
  implementado dentro de cada fila.
- No se cambia `useUsuarios.ts` — se reutiliza `fetchUsuarios()` tal cual.
- El selector de tabla usa una lista fija en el frontend (clientes/leads/
  tickets), no una consulta a la base de datos — coincide con las únicas
  3 tablas que el trigger de auditoría audita hoy.

## Testing (manual, sin suite automatizada aún)

1. Sin ningún filtro activo: la lista carga los primeros 30 registros
   más recientes; si hay más de 30 en total, aparece el botón "Cargar
   más" al final.
2. Click en "Cargar más": se agregan los siguientes 30 registros al
   final de la lista (sin duplicar ni perder los ya cargados); el botón
   desaparece cuando ya no quedan más.
3. Filtrar por una tabla específica (ej. "Leads"): la lista se reemplaza
   (no se acumula) mostrando solo registros de esa tabla, y la
   paginación se reinicia (el botón "Cargar más", si aparece, sigue
   trayendo solo registros de esa tabla).
4. Filtrar por acción ("Eliminó"): solo aparecen registros `delete`.
5. Filtrar por usuario: solo aparecen registros de ese usuario.
6. Filtrar por rango de fechas (solo "Desde", solo "Hasta", y ambos):
   los registros fuera del rango no aparecen.
7. Combinar 2+ filtros a la vez (ej. tabla + rango de fechas): el
   resultado respeta todos los filtros combinados (AND, no OR).
8. Aplicar un filtro sin resultados: aparece "Sin resultados para estos
   filtros" (no "Sin actividad registrada todavía").
9. Quitar todos los filtros (volver a "Todos"/vacío): la lista vuelve a
   mostrar los registros más recientes sin filtrar.
10. Confirmar que expandir una fila (el diff de campos ya implementado)
    sigue funcionando igual con la lista filtrada/paginada.
