# Convertir Reportes en widgets del dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la página `/reportes` y repartir su contenido (4 KPIs + 2 gráficos) en 6 widgets individuales del dashboard (`/`), asignables por usuario desde `/admin/dashboards`, igual que los widgets existentes.

**Architecture:** Migración SQL que inserta 6 filas nuevas en el catálogo `dashboard_widgets` (todas con `resource = 'reportes'`). Cinco componentes nuevos en `app/components/widgets/` que replican, cada uno, un fragmento de la lógica que hoy vive en `app/pages/reportes/index.vue`, más un ajuste al componente `KpiTasaConversion.vue` ya existente para que use la misma fuente de datos (`useReportes().fetchFunnel()`) que los demás. Los 5 componentes nuevos se registran en el `componentMap` de `app/pages/index.vue`. Al final se borra `app/pages/reportes/` y su entrada en el menú (`app/layouts/default.vue`).

**Tech Stack:** Nuxt 4 / Vue 3, Supabase (Postgres + RLS), `nuxt-charts` (`BarChart`, auto-registrado globalmente). Sin dependencias nuevas.

## Global Constraints

- Página `/reportes` y su link en el menú CRM se eliminan por completo (spec: decisión 1).
- 6 widgets separados, uno por métrica/gráfico — no se agrupan (spec: decisión 2).
- El permiso `reportes` (`view`/`view_all`) no cambia — sigue gateando estos widgets vía `resource = 'reportes'` en el catálogo, igual que hoy gatea la página (spec: decisión 3).
- `useReportes.ts` no se modifica — `fetchFunnel()` y `fetchPerformance()` se siguen usando tal cual (spec: decisión 4).
- `KpiTasaConversion.vue` deja de usar `useLeads().fetchLeads()` y pasa a usar `useReportes().fetchFunnel()`, para que las 4 métricas compartan fuente de datos.
- Los tipos exportados por `composables/` (`FunnelItem`, `PerformanceVendedor`) se usan sin `import` explícito — Nuxt los auto-importa, igual que ya hace `app/pages/reportes/index.vue` hoy (verificar: ese archivo usa `ref<FunnelItem[]>` sin ningún `import` en su cabecera).
- Componentes nuevos en `app/components/widgets/` requieren `rm -rf .nuxt && npm run dev` para que Nuxt los registre — el hot-reload no alcanza para archivos nuevos.
- La migración SQL se escribe en este plan pero **se aplica manualmente** (`supabase db push` o el flujo que use el usuario) — no se aplica automáticamente como parte de una tarea.
- Nada de tests automatizados en este repo todavía — la verificación es un checklist manual de navegador.
- Sin comentarios explicativos salvo que documenten un porqué no obvio.

---

### Task 1: Migración SQL — catálogo de widgets de reportes

**Files:**
- Create: `supabase/migrations/20260711000000_reportes_widgets.sql`

**Interfaces:**
- Consumes: tabla `dashboard_widgets` (columnas `key`, `label`, `component`, `tipo`, `resource`, `descripcion`), ya existente desde `20260704000000_dashboard_widgets.sql` + `20260709000100_dashboard_widgets_resource.sql`.
- Produces: 6 filas nuevas en `dashboard_widgets`, con los `component` (`WidgetsKpiTotalLeads`, `WidgetsKpiLeadsGanados`, `WidgetsKpiLeadsPerdidos`, `WidgetsKpiTasaConversion`, `WidgetsChartFunnelLeads`, `WidgetsChartPerformanceVendedores`) que las Tasks 2 y 3 deben nombrar exactamente igual en sus archivos `.vue` para que Nuxt los resuelva.

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/20260711000000_reportes_widgets.sql
--
-- Convierte el contenido de la página /reportes (que se elimina, ver Task 4)
-- en widgets asignables del dashboard. kpi.tasa_conversion no existía en el
-- catálogo pese a que 20260709000100 ya le había preparado la columna
-- resource='leads' sobre una fila que nunca se insertó; acá se crea
-- directamente con resource='reportes', que es lo correcto ahora que las 4
-- métricas comparten fuente de datos (vista_funnel_leads).

insert into dashboard_widgets (key, label, component, tipo, resource, descripcion) values
  ('kpi.total_leads', 'Total leads', 'WidgetsKpiTotalLeads', 'kpi', 'reportes', 'Cantidad total de leads en el pipeline'),
  ('kpi.leads_ganados', 'Leads ganados', 'WidgetsKpiLeadsGanados', 'kpi', 'reportes', 'Leads cerrados como ganados'),
  ('kpi.leads_perdidos', 'Leads perdidos', 'WidgetsKpiLeadsPerdidos', 'kpi', 'reportes', 'Leads cerrados como perdidos'),
  ('kpi.tasa_conversion', 'Tasa de conversión', 'WidgetsKpiTasaConversion', 'kpi', 'reportes', 'Porcentaje de leads ganados sobre cerrados'),
  ('chart.funnel_leads', 'Funnel de leads', 'WidgetsChartFunnelLeads', 'chart', 'reportes', 'Distribución de leads por estado del pipeline'),
  ('chart.performance_vendedores', 'Performance por vendedor', 'WidgetsChartPerformanceVendedores', 'chart', 'reportes', 'Leads ganados y tickets resueltos por vendedor')
on conflict (key) do nothing;
```

- [ ] **Step 2: Aplicar la migración (el usuario la corre con su flujo habitual)**

```bash
supabase db push
```

Confirmar sin error de columna/constraint (la tabla y sus columnas ya existen desde `20260704000000` + `20260709000100`, esta migración solo inserta filas).

- [ ] **Step 3: Verificar en `/admin/dashboards`**

Con el dev server corriendo, entrar como un usuario con `dashboard_widgets.assign` (dueña/superadmin), seleccionar un usuario con permiso `reportes` y confirmar que las 6 filas nuevas aparecen en las listas "KPIs" y "Gráficos" (aunque todavía no se puedan activar sin romper nada — eso se resuelve en las Tasks 2-3, que crean los componentes).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260711000000_reportes_widgets.sql
git commit -m "$(cat <<'EOF'
Agregar catálogo de widgets para reportes (KPIs + gráficos)

6 filas nuevas en dashboard_widgets con resource='reportes', para que
el contenido de /reportes se pueda asignar como widgets individuales
del dashboard en vez de vivir en una página aparte.
EOF
)"
```

---

### Task 2: Widgets KPI (Total leads, Ganados, Perdidos, Tasa de conversión)

**Files:**
- Create: `app/components/widgets/KpiTotalLeads.vue`
- Create: `app/components/widgets/KpiLeadsGanados.vue`
- Create: `app/components/widgets/KpiLeadsPerdidos.vue`
- Modify: `app/components/widgets/KpiTasaConversion.vue`

**Interfaces:**
- Consumes: `useReportes().fetchFunnel(): Promise<FunnelItem[]>` donde `FunnelItem = { estado: string; total: number }` (ya existente, sin cambios). `WidgetsKpiCard` (`label: string`, `valor: number | string`, `cargando?: boolean`, `icono?: string`), ya existente.
- Produces: nada consumido por otra tarea de este plan — Task 4 solo necesita saber los nombres de componente (`KpiTotalLeads`, `KpiLeadsGanados`, `KpiLeadsPerdidos`) y sus imports, ya fijados por la migración de Task 1.

- [ ] **Step 1: Crear `KpiTotalLeads.vue`**

```vue
<script setup lang="ts">
const { fetchFunnel } = useReportes()
const cantidad = ref(0)
const cargando = ref(true)

onMounted(async () => {
  const funnel = await fetchFunnel()
  cantidad.value = funnel.reduce((sum, f) => sum + f.total, 0)
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Total leads" :valor="cantidad" :cargando="cargando" icono="📋" />
</template>
```

- [ ] **Step 2: Crear `KpiLeadsGanados.vue`**

```vue
<script setup lang="ts">
const { fetchFunnel } = useReportes()
const cantidad = ref(0)
const cargando = ref(true)

onMounted(async () => {
  const funnel = await fetchFunnel()
  cantidad.value = funnel.find((f) => f.estado === 'ganado')?.total ?? 0
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Ganados" :valor="cantidad" :cargando="cargando" icono="✅" />
</template>
```

- [ ] **Step 3: Crear `KpiLeadsPerdidos.vue`**

```vue
<script setup lang="ts">
const { fetchFunnel } = useReportes()
const cantidad = ref(0)
const cargando = ref(true)

onMounted(async () => {
  const funnel = await fetchFunnel()
  cantidad.value = funnel.find((f) => f.estado === 'perdido')?.total ?? 0
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Perdidos" :valor="cantidad" :cargando="cargando" icono="❌" />
</template>
```

- [ ] **Step 4: Reemplazar el contenido de `KpiTasaConversion.vue`**

```vue
<script setup lang="ts">
const { fetchFunnel } = useReportes()
const tasa = ref('0%')
const cargando = ref(true)

onMounted(async () => {
  const funnel = await fetchFunnel()
  const ganados = funnel.find((f) => f.estado === 'ganado')?.total ?? 0
  const perdidos = funnel.find((f) => f.estado === 'perdido')?.total ?? 0
  const cerrados = ganados + perdidos
  tasa.value = cerrados > 0 ? `${Math.round((ganados / cerrados) * 100)}%` : '—'
  cargando.value = false
})
</script>

<template>
  <WidgetsKpiCard label="Tasa de conversión" :valor="tasa" :cargando="cargando" icono="📈" />
</template>
```

- [ ] **Step 5: Registrar los 3 componentes nuevos en `app/pages/index.vue`**

En la sección de imports, agregar (junto a los imports de widgets ya existentes):

```ts
import KpiTotalLeads from '~/components/widgets/KpiTotalLeads.vue'
import KpiLeadsGanados from '~/components/widgets/KpiLeadsGanados.vue'
import KpiLeadsPerdidos from '~/components/widgets/KpiLeadsPerdidos.vue'
```

Y en `componentMap`, agregar las 3 entradas (después de `WidgetsKpiTasaConversion`, que ya está registrado):

```ts
  WidgetsKpiTotalLeads: KpiTotalLeads,
  WidgetsKpiLeadsGanados: KpiLeadsGanados,
  WidgetsKpiLeadsPerdidos: KpiLeadsPerdidos,
```

- [ ] **Step 6: `rm -rf .nuxt` y levantar el dev server**

```bash
rm -rf .nuxt
npm run dev
```

- [ ] **Step 7: Checklist manual de navegador**

En `/admin/dashboards`, con un usuario que tenga permiso `reportes` (view o view_all) seleccionado:

1. Activar los 4 widgets KPI (`kpi.total_leads`, `kpi.leads_ganados`, `kpi.leads_perdidos`, `kpi.tasa_conversion`).
2. Loguearse como ese usuario (o navegar a `/` si ya se está logueado con ese usuario) y confirmar que las 4 tarjetas aparecen en el dashboard con números coherentes entre sí (ej. si Total leads = 20, Ganados = 8, Perdidos = 5, la Tasa de conversión debe ser `round(8/(8+5)*100)` = `62%`).
3. Confirmar que el número de Tasa de conversión coincide con el que mostraba antes `/reportes` para el mismo usuario (verificar antes de que Task 4 borre la página, o comparar contra los datos crudos de `vista_funnel_leads` si la página ya no existe al momento de probar).

- [ ] **Step 8: Commit**

```bash
git add app/components/widgets/KpiTotalLeads.vue app/components/widgets/KpiLeadsGanados.vue app/components/widgets/KpiLeadsPerdidos.vue app/components/widgets/KpiTasaConversion.vue app/pages/index.vue
git commit -m "$(cat <<'EOF'
Agregar widgets KPI de reportes al dashboard

KpiTotalLeads, KpiLeadsGanados y KpiLeadsPerdidos nuevos; KpiTasaConversion
pasa de useLeads().fetchLeads() a useReportes().fetchFunnel() para que
las 4 métricas compartan la misma fuente de datos agregada.
EOF
)"
```

---

### Task 3: Widgets de gráficos (Funnel de leads, Performance por vendedor)

**Files:**
- Create: `app/components/widgets/ChartFunnelLeads.vue`
- Create: `app/components/widgets/ChartPerformanceVendedores.vue`
- Modify: `app/pages/index.vue`

**Interfaces:**
- Consumes: `useReportes().fetchFunnel(): Promise<FunnelItem[]>`, `useReportes().fetchPerformance(): Promise<PerformanceVendedor[]>` donde `PerformanceVendedor = { vendedor_id: string; full_name: string | null; leads_total: number; leads_ganados: number; leads_perdidos: number; tickets_total: number; tickets_resueltos: number }` (ya existentes). `usePermissions().can(resource: string, action: string): boolean` (ya existente). `BarChart` (componente global de `nuxt-charts`, mismas props que ya usa `app/pages/reportes/index.vue`: `data`, `categories`, `y-axis`, `height`, `x-formatter`, `x-label`, `y-label`).
- Produces: nada consumido por otra tarea de este plan — Task 4 solo necesita los nombres de componente (`ChartFunnelLeads`, `ChartPerformanceVendedores`), ya fijados por la migración de Task 1.

- [ ] **Step 1: Crear `ChartFunnelLeads.vue`**

```vue
<script setup lang="ts">
const { fetchFunnel } = useReportes()
const funnel = ref<FunnelItem[]>([])
const cargando = ref(true)

const labelsEstado: Record<string, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', cotizado: 'Cotizado',
  negociacion: 'Negociación', ganado: 'Ganado', perdido: 'Perdido',
}

onMounted(async () => {
  funnel.value = await fetchFunnel()
  cargando.value = false
})

const funnelData = computed(() =>
  funnel.value.map((f) => ({ estado: labelsEstado[f.estado] ?? f.estado, total: f.total }))
)
const categorias = { total: { name: 'Leads', color: '#1075B5' } }
const xFormatter = (i: number) => funnelData.value[i]?.estado ?? ''
</script>

<template>
  <div class="border rounded-lg p-4">
    <p class="text-xs text-gray-500 mb-3">Funnel de leads</p>
    <p v-if="cargando" class="text-gray-400 text-sm">Cargando...</p>
    <BarChart
      v-else
      :data="funnelData"
      :categories="categorias"
      :y-axis="['total']"
      :height="280"
      :x-formatter="xFormatter"
      x-label="Estado"
      y-label="Leads"
    />
  </div>
</template>
```

- [ ] **Step 2: Crear `ChartPerformanceVendedores.vue`**

```vue
<script setup lang="ts">
const { fetchPerformance } = useReportes()
const { can } = usePermissions()

const performance = ref<PerformanceVendedor[]>([])
const cargando = ref(true)

onMounted(async () => {
  if (can('reportes', 'view_all')) {
    performance.value = await fetchPerformance()
  }
  cargando.value = false
})

const performanceData = computed(() =>
  performance.value.map((p) => ({
    vendedor: p.full_name ?? 'Sin nombre',
    leads_ganados: p.leads_ganados,
    tickets_resueltos: p.tickets_resueltos,
  }))
)
const categorias = {
  leads_ganados: { name: 'Leads ganados', color: '#22c55e' },
  tickets_resueltos: { name: 'Tickets resueltos', color: '#1075B5' },
}
const xFormatter = (i: number) => performanceData.value[i]?.vendedor ?? ''
</script>

<template>
  <div v-if="can('reportes', 'view_all')" class="border rounded-lg p-4">
    <p class="text-xs text-gray-500 mb-3">Performance por vendedor</p>
    <p v-if="cargando" class="text-gray-400 text-sm">Cargando...</p>
    <BarChart
      v-else
      :data="performanceData"
      :categories="categorias"
      :y-axis="['leads_ganados', 'tickets_resueltos']"
      :height="320"
      :x-formatter="xFormatter"
      x-label="Vendedor"
      y-label="Cantidad"
    />
  </div>
</template>
```

- [ ] **Step 3: Registrar los 2 componentes nuevos en `app/pages/index.vue`**

En la sección de imports, agregar:

```ts
import ChartFunnelLeads from '~/components/widgets/ChartFunnelLeads.vue'
import ChartPerformanceVendedores from '~/components/widgets/ChartPerformanceVendedores.vue'
```

Y en `componentMap`, agregar:

```ts
  WidgetsChartFunnelLeads: ChartFunnelLeads,
  WidgetsChartPerformanceVendedores: ChartPerformanceVendedores,
```

- [ ] **Step 4: `rm -rf .nuxt` y levantar el dev server**

```bash
rm -rf .nuxt
npm run dev
```

- [ ] **Step 5: Checklist manual de navegador**

En `/admin/dashboards`:

1. Activar `chart.funnel_leads` para un usuario con permiso `reportes` (view o view_all). Confirmar que el gráfico de barras aparece en su dashboard con las mismas barras/colores que mostraba antes `/reportes`.
2. Activar `chart.performance_vendedores` para un usuario con `reportes.view_all`. Confirmar que el gráfico aparece con leads ganados y tickets resueltos por vendedor.
3. Activar `chart.performance_vendedores` para un usuario que solo tenga `reportes.view` (sin `view_all`). Confirmar que el widget NO se renderiza (ni el título ni un hueco raro en el grid) — el `v-if` de nivel superior lo oculta completo.

- [ ] **Step 6: Commit**

```bash
git add app/components/widgets/ChartFunnelLeads.vue app/components/widgets/ChartPerformanceVendedores.vue app/pages/index.vue
git commit -m "$(cat <<'EOF'
Agregar widgets de gráficos de reportes al dashboard

ChartFunnelLeads y ChartPerformanceVendedores replican los BarChart que
hoy tiene /reportes. Performance por vendedor mantiene el gate
reportes.view_all que ya tenía en la página.
EOF
)"
```

---

### Task 4: Eliminar la página `/reportes` y su link del menú

**Files:**
- Delete: `app/pages/reportes/index.vue` (y la carpeta `app/pages/reportes/` completa)
- Modify: `app/layouts/default.vue`

**Interfaces:**
- Consumes: nada de las tasks anteriores (esta tarea solo elimina código muerto una vez que Tasks 2-3 ya cubren el mismo contenido como widgets).
- Produces: nada — es la última tarea del plan.

- [ ] **Step 1: Borrar la carpeta de la página**

```bash
rm -rf app/pages/reportes
```

- [ ] **Step 2: Quitar la entrada de "Reportes" del menú CRM**

En `app/layouts/default.vue`, dentro del array `navCrm`, eliminar esta línea:

```ts
    { path: '/reportes', label: 'Reportes', permiso: ['view', 'view_all'] as const, resource: 'reportes' },
```

`navCrm` queda con las 3 entradas restantes (Clientes, Leads, Tickets).

- [ ] **Step 3: `rm -rf .nuxt` y levantar el dev server**

```bash
rm -rf .nuxt
npm run dev
```

- [ ] **Step 4: Checklist manual de navegador**

1. Confirmar que el link "Reportes" ya no aparece en el sidebar del CRM, para ningún rol.
2. Navegar manualmente a `/reportes` y confirmar que Nuxt muestra su página 404 por defecto.
3. Confirmar que los widgets asignados en las Tasks 2-3 siguen funcionando en `/` sin cambios (la eliminación de la página no debe afectar al dashboard).

- [ ] **Step 5: Commit**

```bash
git add -A app/pages/reportes app/layouts/default.vue
git commit -m "$(cat <<'EOF'
Eliminar página /reportes, reemplazada por widgets del dashboard

Su contenido (4 KPIs + 2 gráficos) ahora vive como widgets individuales
asignables desde /admin/dashboards (ver commits anteriores). Se quita
también el link "Reportes" del menú CRM.
EOF
)"
```

---

## Self-Review (completado durante la escritura del plan)

**Cobertura del spec:**
- `/reportes` y su link se eliminan por completo → Task 4. ✓
- 6 widgets separados (3 KPI nuevos + KpiTasaConversion ajustado + 2 charts) → Tasks 2 y 3. ✓
- Permiso `reportes` sigue gateando via `resource` en el catálogo → Task 1 inserta las 6 filas con `resource = 'reportes'`; el filtrado real ocurre en el código ya existente de `index.vue` (`can(w.resource, ...)`) y `admin/dashboards/index.vue` (`recursosVisibles`), sin cambios. ✓
- `useReportes.ts` no se modifica → ninguna task lo toca. ✓
- `KpiTasaConversion.vue` cambia de fuente de datos a `fetchFunnel()` → Task 2, Step 4. ✓
- `kpi.tasa_conversion` faltante en el catálogo → Task 1 lo inserta con `resource = 'reportes'` (no hace falta `update`, la fila nunca existió). ✓
- Gate de `ChartPerformanceVendedores` a `reportes.view_all` → Task 3, Step 2 (`v-if="can('reportes', 'view_all')"` en el nivel superior del template, igual que hacía la página). ✓
- Testing manual del spec (5 casos) → cubierto por los checklists de Task 1 Step 3, Task 2 Step 7, Task 3 Step 5, Task 4 Step 4 en conjunto. ✓
- Fuera de alcance del spec (vistas SQL, permiso `reportes` en sí, asignación automática a usuarios, diseño visual de `WidgetsKpiCard`/`BarChart`) → ninguna task los toca. ✓

**Placeholders:** ninguno — cada archivo se entrega con su contenido completo.

**Consistencia de tipos:** `fetchFunnel(): Promise<FunnelItem[]>` y `fetchPerformance(): Promise<PerformanceVendedor[]>` se usan igual en Tasks 2 y 3 que en el archivo original `app/pages/reportes/index.vue` (mismos nombres de campo: `estado`, `total`, `full_name`, `leads_ganados`, `tickets_resueltos`). Los `component` de la migración (Task 1) coinciden exactamente con los nombres de archivo `.vue` creados en Tasks 2 y 3 (Nuxt antepone `Widgets` + PascalCase del nombre de archivo): `KpiTotalLeads.vue` → `WidgetsKpiTotalLeads`, etc.
