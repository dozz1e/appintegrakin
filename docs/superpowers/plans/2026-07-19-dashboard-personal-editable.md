# Dashboard personal editable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cualquier usuario puede reordenar (drag) y ocultar/reactivar sus propias cards del dashboard personal, sin necesitar el permiso `dashboard_widgets.assign`.

**Architecture:** Nueva policy RLS permisiva que suma `UPDATE` sobre la fila propia de `user_dashboard_widgets` (además de la `ALL` existente para admins con `assign`). Columna `visible` nueva para ocultar sin borrar la asignación. `mis_widgets()` deja de filtrar por visible y expone `widget_id`. Frontend (`index.vue`) agrega un modo edición con `vuedraggable` (ya usado en `LeadKanban.vue`) y una franja de reactivación.

**Tech Stack:** Nuxt 3, Supabase (Postgres + RLS), vuedraggable (ya en `package.json`).

## Global Constraints

- `useSupabaseUser().value?.sub` para el id del usuario logueado — **no** `.id` (gotcha del JWT, ver `useLeadInteracciones.ts:29-38`).
- Sin suite de tests automatizada en este proyecto — verificación es `npm run build` (compila sin error) + prueba manual en navegador (el usuario la hace él mismo, no el agente — ver spec "Testing").
- No tocar `/admin/dashboards` ni la policy `ALL` de admin existente.
- Reordenar y ocultar quedan limitados a la fila propia (`user_id = auth.uid()`); nunca exponer una forma de tocar la fila de otro usuario desde el cliente.
- Spec completo: `docs/superpowers/specs/2026-07-19-dashboard-personal-editable-design.md`.

---

## Task 1: Migración — columna `visible`, policy self-update, `mis_widgets()` con `widget_id`

**Files:**
- Create: `supabase/migrations/20260719000000_dashboard_widgets_self_service.sql`

**Interfaces:**
- Produces: columna `user_dashboard_widgets.visible boolean not null default true`; policy `user_dashboard_widgets_self_update` (UPDATE, `user_id = auth.uid()`); función `mis_widgets()` retornando `(widget_id uuid, key text, label text, component text, resource text, tipo text, orden integer, config jsonb, visible boolean)`.

- [ ] **Step 1: Escribir el archivo de migración**

```sql
-- supabase/migrations/20260719000000_dashboard_widgets_self_service.sql

alter table user_dashboard_widgets
  add column visible boolean not null default true;

create policy user_dashboard_widgets_self_update
  on user_dashboard_widgets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.mis_widgets()
 returns table(widget_id uuid, key text, label text, component text, resource text, tipo text, orden integer, config jsonb, visible boolean)
 language sql stable security definer
as $function$
  select w.id, w.key, w.label, w.component, w.resource, w.tipo, udw.orden, udw.config, udw.visible
  from user_dashboard_widgets udw
  join dashboard_widgets w on w.id = udw.widget_id
  where udw.user_id = auth.uid()
  order by udw.orden;
$function$;
```

- [ ] **Step 2: Aplicar la migración al proyecto Supabase**

Usar la tool `mcp__supabase__apply_migration` con `name: "dashboard_widgets_self_service"` y el mismo `query` del Step 1.

- [ ] **Step 3: Verificar columna, policy y función**

Ejecutar con `mcp__supabase__execute_sql`:

```sql
select column_name from information_schema.columns
where table_name = 'user_dashboard_widgets' and column_name = 'visible';

select policyname, cmd from pg_policies
where tablename = 'user_dashboard_widgets' and policyname = 'user_dashboard_widgets_self_update';

select pg_get_functiondef(oid) from pg_proc where proname = 'mis_widgets';
```

Expected: la columna existe, la policy existe con `cmd = 'UPDATE'`, y la definición de `mis_widgets()` incluye `widget_id` y `visible` en el `RETURNS TABLE`.

- [ ] **Step 4: Regenerar tipos TypeScript**

Usar `mcp__supabase__generate_typescript_types` y escribir el resultado (campo `types` del JSON) en `app/types/database.types.ts` (mismo procedimiento ya usado antes en este proyecto: parsear el JSON de salida y sobreescribir el archivo completo).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260719000000_dashboard_widgets_self_service.sql app/types/database.types.ts
git commit -m "$(cat <<'EOF'
feat: allow users to self-manage dashboard widget order and visibility

Adds a visible column and a permissive UPDATE policy scoped to the
user's own user_dashboard_widgets rows, so reordering/hiding no
longer requires the dashboard_widgets.assign permission. mis_widgets()
now also returns widget_id (needed for the client-side updates) and
visible (no longer filtered server-side).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `useDashboardWidgets.ts` — tipos y funciones self-service

**Files:**
- Modify: `app/composables/useDashboardWidgets.ts`

**Interfaces:**
- Consumes: tabla `user_dashboard_widgets` (columnas `widget_id`, `user_id`, `orden`, `visible`), RPC `mis_widgets()` de Task 1.
- Produces: `MiWidget` con `widgetId: string` y `visible: boolean`; `reordenarMisWidgets(items: { widgetId: string; orden: number }[]): Promise<void>`; `setVisibilidadMiWidget(widgetId: string, visible: boolean): Promise<void>`.

- [ ] **Step 1: Actualizar la interfaz `MiWidget`**

En `app/composables/useDashboardWidgets.ts:3-11`, reemplazar:

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
```

por:

```ts
export interface MiWidget {
  widgetId: string
  key: string
  label: string
  component: string
  resource: string
  tipo: 'kpi' | 'chart'
  orden: number
  config: Record<string, unknown>
  visible: boolean
}
```

- [ ] **Step 2: Agregar `reordenarMisWidgets` y `setVisibilidadMiWidget`**

Agregar dentro de `useDashboardWidgets` (después de `cargarMisWidgets`, antes del comentario "A partir de acá..."):

```ts
  // Self-service: reordenar/ocultar los propios widgets no requiere el
  // permiso dashboard_widgets.assign - la policy RLS ya lo restringe a
  // la fila propia (user_id = auth.uid()).
  const reordenarMisWidgets = async (items: { widgetId: string; orden: number }[]) => {
    const user = useSupabaseUser()
    const uid = user.value?.sub
    if (!uid) return
    await Promise.all(
      items.map(({ widgetId, orden }) =>
        supabase.from('user_dashboard_widgets').update({ orden }).eq('widget_id', widgetId).eq('user_id', uid)
      )
    )
  }

  const setVisibilidadMiWidget = async (widgetId: string, visible: boolean) => {
    const user = useSupabaseUser()
    const uid = user.value?.sub
    if (!uid) return
    const { error } = await supabase
      .from('user_dashboard_widgets')
      .update({ visible })
      .eq('widget_id', widgetId)
      .eq('user_id', uid)
    if (error) throw error
  }
```

- [ ] **Step 3: Exportar las funciones nuevas**

En el `return` final de `useDashboardWidgets`, agregar `reordenarMisWidgets` y `setVisibilidadMiWidget` junto a las existentes.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: compila sin error de tipos (confirma que `MiWidget.widgetId`/`visible` no rompen ningún consumidor existente — el único consumidor hoy es `index.vue`, que se toca en Task 3).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useDashboardWidgets.ts
git commit -m "$(cat <<'EOF'
feat: add self-service reorder/hide functions to useDashboardWidgets

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `index.vue` — modo edición, drag and drop, ocultar/reactivar

**Files:**
- Modify: `app/pages/index.vue`

**Interfaces:**
- Consumes: `useDashboardWidgets()` → `misWidgets`, `cargarMisWidgets`, `reordenarMisWidgets`, `setVisibilidadMiWidget` (Task 2); `draggable` de `vuedraggable` (patrón de uso: `app/components/leads/LeadKanban.vue:101-120`).
- Produces: UI del dashboard personal con edición inline. No expone nada a otros archivos (página hoja).

- [ ] **Step 1: Importar `draggable` y separar visibles/ocultos por sección**

Reemplazar las líneas 69-79 actuales:

```ts
const { misWidgets, cargarMisWidgets } = useDashboardWidgets()
const cargando = ref(true)

onMounted(async () => {
  await cargarMisWidgets()
  cargando.value = false
})

const widgetsVisibles = computed(() => misWidgets.value)
const kpisVisibles = computed(() => widgetsVisibles.value.filter((w) => w.tipo === 'kpi'))
const chartsVisibles = computed(() => widgetsVisibles.value.filter((w) => w.tipo === 'chart'))
```

por:

```ts
import draggable from 'vuedraggable'

const { misWidgets, cargarMisWidgets, reordenarMisWidgets, setVisibilidadMiWidget } = useDashboardWidgets()
const { error: toastError } = useToast()
const cargando = ref(true)
const modoEdicion = ref(false)

onMounted(async () => {
  await cargarMisWidgets()
  cargando.value = false
})

// draggable necesita mutar arrays directamente (mismo motivo que
// LeadKanban.vue) - se sincronizan con misWidgets vía watch.
const kpis = ref<MiWidget[]>([])
const charts = ref<MiWidget[]>([])
const kpisOcultos = ref<MiWidget[]>([])
const chartsOcultos = ref<MiWidget[]>([])

function reconstruir() {
  kpis.value = misWidgets.value.filter((w) => w.tipo === 'kpi' && w.visible)
  charts.value = misWidgets.value.filter((w) => w.tipo === 'chart' && w.visible)
  kpisOcultos.value = misWidgets.value.filter((w) => w.tipo === 'kpi' && !w.visible)
  chartsOcultos.value = misWidgets.value.filter((w) => w.tipo === 'chart' && !w.visible)
}

watch(misWidgets, reconstruir, { deep: true })

const widgetsVisibles = computed(() => [...kpis.value, ...charts.value])
const kpisVisibles = kpis
const chartsVisibles = charts
```

Nota: `MiWidget` debe importarse desde el composable: agregar `import type { MiWidget } from '~/composables/useDashboardWidgets'` al inicio del `<script setup>` (junto a los imports de widgets ya existentes).

- [ ] **Step 2: Agregar `guardarOrden` y `ocultar`/`reactivar`**

Agregar después de `watch(misWidgets, reconstruir, ...)`:

```ts
async function guardarOrden(lista: MiWidget[]) {
  const previo = misWidgets.value.map((w) => ({ ...w }))
  try {
    await reordenarMisWidgets(lista.map((w, i) => ({ widgetId: w.widgetId, orden: i })))
  } catch {
    misWidgets.value = previo
    toastError('No se pudo guardar el nuevo orden')
  }
}

async function ocultar(widget: MiWidget) {
  const previo = misWidgets.value.map((w) => ({ ...w }))
  try {
    await setVisibilidadMiWidget(widget.widgetId, false)
    const w = misWidgets.value.find((x) => x.widgetId === widget.widgetId)
    if (w) w.visible = false
  } catch {
    misWidgets.value = previo
    toastError('No se pudo ocultar el widget')
  }
}

async function reactivar(widget: MiWidget) {
  const previo = misWidgets.value.map((w) => ({ ...w }))
  try {
    await setVisibilidadMiWidget(widget.widgetId, true)
    const w = misWidgets.value.find((x) => x.widgetId === widget.widgetId)
    if (w) w.visible = true
  } catch {
    misWidgets.value = previo
    toastError('No se pudo reactivar el widget')
  }
}
```

- [ ] **Step 3: Reemplazar el template**

Reemplazar el `<template>` completo (líneas 82-121 actuales) por:

```vue
<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-semibold">Tu dashboard</h1>
      <button
        v-if="!cargando && widgetsVisibles.length + kpisOcultos.length + chartsOcultos.length > 0"
        type="button"
        class="text-sm font-medium border rounded-lg px-3 py-1.5 transition-colors"
        :class="modoEdicion
          ? 'bg-primary text-ink-onprimary border-primary'
          : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'"
        @click="modoEdicion = !modoEdicion"
      >
        {{ modoEdicion ? 'Listo' : 'Editar dashboard' }}
      </button>
    </div>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>

    <p v-else-if="widgetsVisibles.length === 0 && kpisOcultos.length === 0 && chartsOcultos.length === 0" class="text-gray-400 text-sm">
      Todavía no tienes ningún widget asignado. Pídele a tu administrador que te active
      alguno desde el panel de dashboards.
    </p>

    <p v-else-if="widgetsVisibles.some((w) => !componentMap[w.component])" class="text-red-500 text-sm">
      Un widget asignado no tiene componente registrado en el mapa (revisa la consola).
    </p>

    <template v-else>
      <draggable
        v-if="kpisVisibles.length"
        v-model="kpis"
        :disabled="!modoEdicion"
        item-key="widgetId"
        tag="div"
        class="grid gap-4 mb-6"
        :style="{ gridTemplateColumns: `repeat(${Math.min(kpisVisibles.length, 8)}, minmax(0, 1fr))` }"
        @end="guardarOrden(kpis)"
      >
        <template #item="{ element: w }">
          <div class="relative" :class="modoEdicion ? 'cursor-grab active:cursor-grabbing' : ''">
            <button
              v-if="modoEdicion"
              type="button"
              title="Ocultar"
              class="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-gray-700 text-white flex items-center justify-center hover:bg-danger transition-colors"
              @click="ocultar(w)"
            >
              <Icon name="mdi:close" class="w-3.5 h-3.5" />
            </button>
            <component :is="componentMap[w.component]" v-bind="w.config" />
          </div>
        </template>
      </draggable>

      <draggable
        v-if="chartsVisibles.length"
        v-model="charts"
        :disabled="!modoEdicion"
        item-key="widgetId"
        tag="div"
        class="grid grid-cols-1 lg:grid-cols-2 gap-4"
        @end="guardarOrden(charts)"
      >
        <template #item="{ element: w }">
          <div class="relative" :class="modoEdicion ? 'cursor-grab active:cursor-grabbing' : ''">
            <button
              v-if="modoEdicion"
              type="button"
              title="Ocultar"
              class="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-gray-700 text-white flex items-center justify-center hover:bg-danger transition-colors"
              @click="ocultar(w)"
            >
              <Icon name="mdi:close" class="w-3.5 h-3.5" />
            </button>
            <component :is="componentMap[w.component]" v-bind="w.config" />
          </div>
        </template>
      </draggable>

      <div
        v-if="modoEdicion && (kpisOcultos.length || chartsOcultos.length)"
        class="mt-8 pt-4 border-t border-gray-100"
      >
        <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Widgets ocultos</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="w in [...kpisOcultos, ...chartsOcultos]"
            :key="w.widgetId"
            type="button"
            class="flex items-center gap-1.5 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg px-3 py-1.5 opacity-60 hover:opacity-100 hover:border-primary hover:text-primary transition-all"
            @click="reactivar(w)"
          >
            <Icon name="mdi:plus" class="w-3.5 h-3.5" />
            {{ w.label }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: `✨ Build complete!` sin errores de tipos ni de template.

- [ ] **Step 5: Commit**

```bash
git add app/pages/index.vue
git commit -m "$(cat <<'EOF'
feat: let users reorder and hide their own dashboard widgets

Adds an edit mode to the personal dashboard: drag-and-drop reordering
per section (KPIs, charts) via vuedraggable, a hide button per card,
and a strip to reactivate hidden widgets. Backed by the self-service
RLS policy and visible column added in the previous commits.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Verificación manual (usuario)

**Files:** ninguno — checklist de prueba en navegador, la ejecuta el usuario.

- [ ] **Step 1: Pasar la lista de verificación al usuario**

Avisar que están listos para probar en `/` con un usuario SIN permiso `dashboard_widgets.assign`, siguiendo el checklist del spec (`docs/superpowers/specs/2026-07-19-dashboard-personal-editable-design.md`, sección "Testing"):

1. Entrar a modo edición, arrastrar una KPI a otra posición, salir de modo edición, recargar — el orden persiste.
2. Ocultar una card — desaparece del grid, aparece en la franja de ocultos.
3. Reactivar esa card desde la franja — vuelve al grid con datos reales.
4. Ocultar todas las cards de una sección — el grid desaparece, franja muestra todas.
5. Confirmar en `/admin/dashboards` que asignar/desasignar widgets a otros usuarios sigue funcionando igual.
