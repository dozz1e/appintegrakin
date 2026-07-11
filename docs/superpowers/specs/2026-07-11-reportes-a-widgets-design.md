# Convertir Reportes en widgets del dashboard

## Contexto

Pedido del usuario: la sección "Reportes" del menú CRM (`/reportes`,
`app/pages/reportes/index.vue`) deja de existir como página propia. Su
contenido —4 KPIs (total leads, ganados, perdidos, tasa de conversión) y 2
gráficos (funnel de leads, performance por vendedor)— pasa a vivir como
widgets individuales del dashboard (`/`, `app/pages/index.vue`), el mismo
sistema que ya usan `KpiLeadsActivos`, `KpiTicketsAbiertos`,
`KpiClientesTotales` y `ChartLeadsPorEstado`: el admin (dueña/superadmin)
asigna cada widget a cada usuario desde `/admin/dashboards`
(`app/pages/admin/dashboards/index.vue`), y el usuario ve solo lo que le
asignaron y para lo que tiene permiso (`useDashboardWidgets.ts`,
`mis_widgets()` RPC).

Los datos ya existen y no cambian: `useReportes.ts` expone `fetchFunnel()`
(vista `vista_funnel_leads`) y `fetchPerformance()` (vista
`vista_performance_vendedores`), ambas fuera de alcance de este cambio.

Hallazgo durante el diseño: ya existe un componente
`app/components/widgets/KpiTasaConversion.vue` y la migración
`20260709000100_dashboard_widgets_resource.sql` ya le asignó
`resource = 'leads'`, pero **nunca se insertó la fila en el catálogo**
`dashboard_widgets` — hoy ese widget no es asignable a nadie. Este cambio lo
completa de paso, y de camino le cambia la fuente de datos para que sea
consistente con los otros 3 KPIs nuevos (ver más abajo).

## Decisiones de producto (validadas con el usuario)

1. **La página `/reportes` y su link en el menú se eliminan por completo.**
   No queda una vista "todo junto"; los KPIs y gráficos solo aparecen si el
   admin los asigna como widgets.
2. **Granularidad: 6 widgets separados**, uno por métrica/gráfico — mismo
   patrón granular que los widgets existentes, para que el admin arme el
   dashboard de cada usuario a su gusto.
3. **El permiso `reportes` (`view`/`view_all`) se mantiene** — sigue
   gateando la visibilidad de estos 6 widgets vía
   `can(w.resource, 'view') || can(w.resource, 'view_all')` en
   `index.vue`, igual que hoy gatea la página.
4. **`useReportes.ts` no cambia** — sigue siendo el composable que consumen
   los widgets nuevos, en vez de la página.

## Diseño

### Componentes nuevos

En `app/components/widgets/`, mismo patrón que los widgets existentes (cada
uno hace su propio fetch en `onMounted`, sin recibir props de datos):

- **`KpiTotalLeads.vue`** — `fetchFunnel()`, suma todos los `total`.
  Renderiza con `WidgetsKpiCard` (`label="Total leads"`, icono `📋`).
- **`KpiLeadsGanados.vue`** — `fetchFunnel()`, busca `estado === 'ganado'`.
  `WidgetsKpiCard` (`label="Ganados"`, icono `✅`).
- **`KpiLeadsPerdidos.vue`** — `fetchFunnel()`, busca `estado === 'perdido'`.
  `WidgetsKpiCard` (`label="Perdidos"`, icono `❌`).
- **`ChartFunnelLeads.vue`** — envuelve el mismo `BarChart` que hoy tiene
  `reportes/index.vue` (labels de estado, color `#1075B5`, altura 280),
  dentro de un `WidgetsKpiCard`-like wrapper simple (`div` con título, igual
  que `ChartLeadsPorEstado.vue` ya hace con su propio `<div class="border
  rounded-lg p-4">`).
- **`ChartPerformanceVendedores.vue`** — mismo `BarChart` de performance
  (leads ganados + tickets resueltos por vendedor). Antes de hacer fetch,
  chequea `can('reportes', 'view_all')`; si no lo tiene, no renderiza nada
  (mismo comportamiento que hoy tenía la página, que ocultaba esta sección
  completa con `v-if="can('reportes', 'view_all')"`).

### Componente existente que se ajusta

- **`KpiTasaConversion.vue`** — hoy calcula la tasa con
  `useLeads().fetchLeads()` (trae todos los leads y cuenta en el cliente).
  Se cambia a `useReportes().fetchFunnel()` + la misma fórmula que usaba
  `reportes/index.vue` (`ganados / (ganados + perdidos)`), para que las 4
  métricas de "reportes" compartan la misma fuente de datos (la vista
  agregada, no un fetch completo de leads). El label/icono (`📈`) no
  cambian.

### Registro en el dashboard

En `app/pages/index.vue`, se agregan los 5 imports + entradas al
`componentMap` (KpiTasaConversion ya está importado y registrado):

```ts
import KpiTotalLeads from '~/components/widgets/KpiTotalLeads.vue'
import KpiLeadsGanados from '~/components/widgets/KpiLeadsGanados.vue'
import KpiLeadsPerdidos from '~/components/widgets/KpiLeadsPerdidos.vue'
import ChartFunnelLeads from '~/components/widgets/ChartFunnelLeads.vue'
import ChartPerformanceVendedores from '~/components/widgets/ChartPerformanceVendedores.vue'

// ...dentro de componentMap:
WidgetsKpiTotalLeads: KpiTotalLeads,
WidgetsKpiLeadsGanados: KpiLeadsGanados,
WidgetsKpiLeadsPerdidos: KpiLeadsPerdidos,
WidgetsChartFunnelLeads: ChartFunnelLeads,
WidgetsChartPerformanceVendedores: ChartPerformanceVendedores,
```

### Migración SQL (catálogo de widgets)

Nueva migración `supabase/migrations/<timestamp>_reportes_widgets.sql` que
inserta las 6 filas en `dashboard_widgets` (incluye `kpi.tasa_conversion`,
que faltaba):

```sql
insert into dashboard_widgets (key, label, component, tipo, resource, descripcion) values
  ('kpi.total_leads', 'Total leads', 'WidgetsKpiTotalLeads', 'kpi', 'reportes', 'Cantidad total de leads en el pipeline'),
  ('kpi.leads_ganados', 'Leads ganados', 'WidgetsKpiLeadsGanados', 'kpi', 'reportes', 'Leads cerrados como ganados'),
  ('kpi.leads_perdidos', 'Leads perdidos', 'WidgetsKpiLeadsPerdidos', 'kpi', 'reportes', 'Leads cerrados como perdidos'),
  ('kpi.tasa_conversion', 'Tasa de conversión', 'WidgetsKpiTasaConversion', 'kpi', 'reportes', 'Porcentaje de leads ganados sobre cerrados'),
  ('chart.funnel_leads', 'Funnel de leads', 'WidgetsChartFunnelLeads', 'chart', 'reportes', 'Distribución de leads por estado del pipeline'),
  ('chart.performance_vendedores', 'Performance por vendedor', 'WidgetsChartPerformanceVendedores', 'chart', 'reportes', 'Leads ganados y tickets resueltos por vendedor')
on conflict (key) do nothing;
```

`kpi.tasa_conversion` ya tenía `resource = 'leads'` seteado por la migración
anterior sobre una fila que no existía; esta migración la crea directamente
con `resource = 'reportes'` (no hace falta un `update` porque la fila nunca
existió).

Esta migración se aplica con el flujo normal del proyecto (`supabase db
push` o equivalente) — no se aplica automáticamente como parte de este
cambio de código.

### Eliminación de la página y el link

- Se borra `app/pages/reportes/` (carpeta completa).
- En `app/layouts/default.vue`, se quita la entrada `{ path: '/reportes',
  label: 'Reportes', ... }` del array `navCrm`.

## Fuera de alcance

- No se tocan `useReportes.ts`, `vista_funnel_leads` ni
  `vista_performance_vendedores` — infraestructura existente, se sigue
  consumiendo igual.
- No se toca el permiso `reportes` en sí (`permissions`/`role_permissions`)
  — ya existe y sigue gateando estos widgets vía el mecanismo genérico de
  `dashboard_widgets.resource`.
- No se agrega ninguna asignación automática de estos widgets a usuarios
  existentes — igual que los widgets actuales, quedan en el catálogo y el
  admin decide a quién dárselos desde `/admin/dashboards`.
- No se cambia el diseño visual de `WidgetsKpiCard` ni de `BarChart`.

## Testing (manual, sin suite automatizada aún)

1. Aplicar la migración nueva y confirmar que las 6 filas aparecen en
   `/admin/dashboards` bajo "KPIs" y "Gráficos", filtradas correctamente
   por `recursosVisibles` (solo visibles si el usuario seleccionado tiene
   permiso sobre `reportes`).
2. Asignar los 6 widgets a un usuario con `reportes.view_all` y confirmar
   que los 6 aparecen en su dashboard (`/`) con los mismos números/gráficos
   que mostraba antes `/reportes`.
3. Asignar los widgets a un usuario con solo `reportes.view` (sin
   `view_all`) y confirmar que `ChartPerformanceVendedores` no se renderiza
   (o no rompe nada), igual que la página ocultaba esa sección.
4. Confirmar que `/reportes` ya no existe (404) y que el link desapareció
   del menú CRM para todos los roles.
5. Confirmar que `KpiTasaConversion` sigue mostrando el mismo porcentaje
   que antes del cambio de fuente de datos.
