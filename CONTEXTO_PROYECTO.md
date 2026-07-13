# Integrakin CRM — Contexto del proyecto

> Documento de referencia técnica, generado a partir de una inspección real
> del repo (no solo de memoria de chat). Útil para retomar el proyecto en una
> cuenta nueva de Claude (pegarlo como primer mensaje) o para cualquier
> desarrollador que se sume.
>
> Última actualización: 13 de julio de 2026.

## Stack y dependencias reales

- **Framework:** Nuxt 4.4.8 — todo bajo `app/` (pages, components, composables,
  middleware, layouts, types); `server/` y `supabase/` quedan en la raíz.
- **Vue:** 3.5.38 · **vue-router:** 5.1.0
- **Base de datos:** Supabase (`@nuxtjs/supabase` 2.0.9) — Postgres + RLS +
  Realtime.
- **Hosting:** Vercel (`@vercel/analytics` 2.0.1, `@vercel/speed-insights` 2.0.0).
- **Estilos:** `@nuxtjs/tailwindcss` 6.14.0. Sistema de design tokens (CSS
  custom properties) adoptado en `app/components/shared/` — colores como
  `bg-primary`, `text-ink`, `border-border` en vez de hex arbitrarios sueltos
  (`bg-[#1075B5]` sigue existiendo en código más viejo no migrado).
- **Iconos:** `@iconify-json/mdi` (devDependency).
- **Estado:** Pinia (`@pinia/nuxt` 0.11.3).
- **Charts:** `nuxt-charts` 2.1.4 — el componente `BarChart` exige la prop
  `y-axis` (array de claves de `categories`). Omitirla revienta el `setup()`
  y puede dejar el router de Vue en estado inconsistente hasta recargar.
- **Drag & drop:** `vuedraggable` 4.1.0 (`@next`).
- **CSV:** `papaparse` 5.4.1 + `@types/papaparse` (devDependencies).
- **Linting:** `@nuxt/eslint` 1.16.0 únicamente. **Nunca** agregar
  `@nuxtjs/eslint-module` (legacy) en paralelo — trae `vite-plugin-eslint`,
  que colisiona con versiones de `ajv` y rompe el dev server.
- **`overrides` en package.json:** `"ajv": "^8.20.0"` — necesario por el
  conflicto de versiones entre `ajv-keywords` (quiere v8) y `eslint`/
  `@eslint/eslintrc` (quieren v6). Instalar paquetes nuevos siempre con
  `--legacy-peer-deps` (conflicto conocido `@vercel/analytics` peer
  `vue-router@^4` vs el `^5` real del proyecto).

## Estructura completa del repo (inventario real)

### Migraciones SQL (`supabase/migrations/`, en orden cronológico)
```
20260702000000_extensions.sql
20260702000100_roles_permisos_profiles.sql
20260702000200_clientes_leads_tickets.sql
20260702000300_rls_policies.sql
20260702000400_permisos_efectivos_usuario.sql
20260702000500_convertir_lead_a_cliente.sql
20260702000600_seed_roles_permisos.sql
20260702000700_kame_tokens.sql
20260702000800_audit_log.sql
20260702000900_rls_profiles.sql
20260703000000_superadmin_features.sql
20260704000000_dashboard_widgets.sql
20260705000000_tareas.sql
20260705000100_lead_interacciones.sql
20260707010000_optimistic_locking.sql
20260707020000_notificaciones.sql
20260708000000_notificaciones_realtime.sql
20260709000000_rls_permisos_admin.sql
20260709000100_dashboard_widgets_resource.sql
20260710000000_notificacion_tarea_vencida.sql
20260711000000_reportes_widgets.sql
20260712000000_imagen_cliente.sql
20260712010000_direccion_cliente.sql
20260713000000_productos.sql
20260713000100_productos_rls.sql
20260713000200_productos_permisos.sql
20260713000300_ventas.sql
20260713000400_ventas_rls.sql
20260713000500_ventas_permisos.sql
```
Nota: las 5 migraciones desde `tareas` hasta `notificaciones_realtime` se
crearon originalmente a mano en el SQL Editor de Supabase; ya quedaron
versionadas (esquema/funciones/triggers extraídos de la base real vía
`information_schema`/`pg_constraint`/`pg_policies`/`pg_trigger`/`pg_proc`,
no reaplicadas contra prod porque ya existen ahí).

### Páginas (`app/pages/`)
```
403.vue                        — página de acceso denegado
login.vue                      — login (ruta pública, ver auth.global.ts)
index.vue                      — dashboard con widgets por usuario
admin/auditoria/index.vue      — visor de audit_log (permiso auditoria.view_all),
                                  con filtros (usuario/tabla/acción/fechas),
                                  paginación "Cargar más" y diff de campos
admin/dashboards/index.vue     — asignación de dashboard_widgets por usuario (dueña)
admin/permisos/index.vue       — gestión de overrides de permisos por usuario
                                  (grant/revoke individual sobre el rol base)
panel-dev/index.vue            — panel superadmin: features, errores, usuarios
clientes/index.vue             — listado (carga clientes + usuarios para el filtro)
clientes/[id].vue              — detalle/edición (optimistic locking)
clientes/nuevo.vue
leads/index.vue                — Kanban (LeadKanban) + import/export CSV
leads/[id].vue                 — detalle en 3 columnas + timeline de interacciones + tareas
leads/nuevo.vue
tickets/index.vue              — Kanban (TicketBoard)
tickets/[id].vue                — detalle en 2 columnas (optimistic locking)
tickets/nuevo.vue
productos/index.vue            — listado (tabla) con búsqueda, filtros e import/export CSV
productos/[id].vue             — detalle/edición (optimistic locking)
productos/nuevo.vue
```
Nota: `reportes/index.vue` **ya no existe** — se eliminó y su contenido
(funnel + performance por vendedor) se convirtió en widgets asignables del
dashboard (ver sección Roadmap).

### Composables (`app/composables/`)
```
useAuditoria, useAuth, useBusquedaGlobal, useClientes, useCsv,
useDashboardWidgets, useErrorLog, useFeatures, useLeadInteracciones,
useLeads, useMiPerfil, useNotificaciones, usePermisosOverrides,
usePermissions, useProductos, useReportes, useSuperadmin, useTareas,
useTickets, useToast, useUsuarios, useVentas
```

### Componentes (`app/components/`)
```
clientes/ClienteForm.vue, clientes/ClienteSplitView.vue, clientes/VentaList.vue
leads/LeadForm.vue, leads/LeadKanban.vue, leads/LeadTimeline.vue
tickets/TicketBoard.vue, tickets/TicketForm.vue
productos/ProductoForm.vue
shared/AppLogo, Avatar, Badge, Card, ConfirmDialog, GlobalSearch,
       NavLink, NotificationBell, PageHeader, TareaList, ToastContainer
widgets/ChartFunnelLeads, ChartLeadsPorEstado, ChartPerformanceVendedores,
        KpiCard, KpiClientesTotales, KpiLeadsActivos, KpiLeadsGanados,
        KpiLeadsPerdidos, KpiTasaConversion, KpiTicketsAbiertos, KpiTotalLeads
```
Nota: `clientes/ClienteTable.vue` fue reemplazado por
`clientes/ClienteSplitView.vue` (vista de detalle en panel dividido, ver
Roadmap). Los widgets de KPI/chart de `reportes` (`ChartFunnelLeads`,
`ChartPerformanceVendedores`, `KpiLeadsGanados`, `KpiLeadsPerdidos`,
`KpiTotalLeads`) son nuevos, agregados al convertir `/reportes` en widgets.

### Layout (`app/layouts/default.vue`)
Sidebar + topbar. Ítems de nav construidos por permiso (`can(resource,
action)`), no hardcodeados a un rol. Sección "CRM" (Clientes/Leads/Tickets/
Productos), sección "Administración" (Dashboards/Permisos/Auditoría, cada
uno con su propio gate), sección "Sistema" (Panel dev, solo superadmin).

### Middleware (`app/middleware/`)
```
auth.global.ts   — corre en TODAS las rutas; redirige a /login si no hay
                   sesión; si la sesión se restauró por cookie (refresh,
                   URL directa, pestaña nueva) carga permisos/superadmin/
                   features/widgets/perfil aquí, ya que login.vue no corrió
permission.ts    — usado vía definePageMeta({ middleware: 'permission',
                   permiso: { resource, actions } })
superadmin.ts    — gating de /panel-dev
```

## Modelo de permisos

RBAC + overrides individuales + ReBAC simple:

- `profiles.role_id` → FK única a `roles.id` (NO existe `user_roles`
  many-to-many, se descartó ese diseño).
- `roles.name` (no `nombre`) — columna en inglés, valores en español
  (ej. `'dueña'`, `'vendedor'`).
- `permissions(resource, action)` — recurso y acción como columnas separadas.
- `role_permissions(role_id, permission_id)`.
- `user_permission_overrides(user_id, permission_id, effect, created_by)` —
  excepciones individuales (grant/revoke) por encima del rol. **Ya tiene
  pantalla de UI** en `/admin/permisos` (gateada por el mismo permiso que
  `/admin/dashboards`, `dashboard_widgets.assign`) — antes solo se podía
  gestionar a mano por SQL, ya no es necesario.
- `has_permission(p_user uuid, p_resource text, p_action text) returns boolean`
  — firma con 3 argumentos separados.
- `permisos_efectivos_usuario(p_user uuid) returns table(resource text, action text)`.
- Patrón en páginas: `definePageMeta({ middleware: 'permission', permiso: {
  resource: 'x', actions: ['view','view_all'] } })`; `can(resource, action)`
  desde `usePermissions()` para gating en templates/sidebar.

### Superadmin
Tabla `superadmins(user_id)` — sin políticas de insert/update/delete desde
el cliente. Solo se puebla vía SQL Editor de Supabase.

### Dos sistemas que no hay que confundir
1. **`features`/`user_features`** — flags de funcionalidad, solo superadmin
   (gestionado desde `/panel-dev`).
2. **`dashboard_widgets`/`user_dashboard_widgets`** — catálogo de tarjetas
   KPI/chart que la dueña asigna por usuario desde `/admin/dashboards`, vía
   permiso `dashboard_widgets.assign`. El `componentMap` en `app/pages/index.vue`
   resuelve manualmente el string `component` de cada widget a su componente
   real (el auto-import de Nuxt no resuelve `<component :is="stringName">`).
   Cada widget tiene columna `resource` (agregada en
   `20260709000100_dashboard_widgets_resource.sql`) para filtrar tanto al
   asignarlo como al renderizarlo según los permisos del usuario.

   **El acceso a una página completa (ej. `/productos`) se controla por el
   sistema de permisos normal, NO por este catálogo.** Ya nos confundimos una
   vez con esto — son mecanismos independientes.

## Schema real de las tablas principales

- **`leads`**: `nombre, telefono, email, origen, estado, cliente_id, owner_id,
  created_by, version, created_at, updated_at`. Estados
  (`leads_estado_check`): `nuevo, contactado, cotizado, negociacion, ganado,
  perdido` (6 estados — incluye `negociacion` entre `cotizado` y `ganado`).
- **`clientes`**: `rut (unique, nullable), razon_social, nombre_contacto,
  telefono, email, kame_id, owner_id, created_by, version, direccion
  (agregada 2026-07-12), imagen_url (agregada 2026-07-12)`. No tiene
  `nombre` (usa `razon_social`). `imagen_url` apunta al bucket público de
  Storage `clientes-imagenes` (fotos/logos de clientes B2B, no datos
  sensibles — bucket público a propósito para servir `<img src>` directo
  sin pasar por el cliente de Supabase; la escritura queda gateada por
  `clientes.edit`).
- **`tickets`**: `cliente_id, titulo, descripcion, estado, prioridad,
  owner_id, created_by, version`. Estados (`tickets_estado_check`): `abierto,
  en_proceso, esperando_cliente, resuelto, cerrado`. Prioridad: `baja, media,
  alta, urgente`.
- **`productos`** (ver `20260713000000_productos.sql`, nuevo módulo):
  `nombre, sku (unique), categoria, unidad_medida, estado
  ('activo'|'inactivo', default 'activo'), created_by, version`. **Sin
  `owner_id`** — es un catálogo compartido, no "propiedad" de un vendedor,
  así que `view`/`view_all` se comportan igual (ambos ven el catálogo
  completo). Auditado (trigger `registrar_auditoria()`) y con optimistic
  locking igual que clientes/leads/tickets. Permisos propios
  (`productos.view/view_all/create/edit/delete`) dados por defecto solo al
  rol `dueña` — el resto de roles se activa manualmente desde
  `/admin/permisos`. 561 productos reales importados desde el Excel del
  usuario (vía CSV, mismo proceso ya usado para los 1893 clientes).
- **`ventas`** (ver `20260713000300_ventas.sql`, nuevo módulo): `cliente_id,
  producto_id, valor, fecha, owner_id, created_by, version`. Primera
  conexión de `productos` con otra entidad. `fecha` es `timestamptz`
  (fecha y hora), combinada en `ClientesVentaList.vue` igual que
  `fecha_vencimiento` de tareas pero **sin** default de hora — hora vacía
  es error de validación, no se omite. **Con `owner_id`** (a diferencia de
  `productos`) — RLS igual que `tickets` (propio vs `view_all`). UI: nueva
  pestaña "Ventas" en `ClienteSplitView.vue` (antes solo tenía
  Información/Tickets), formulario de alta + historial de solo lectura, sin
  editar/borrar. Sin precio de lista en `productos` — el valor se tipea a
  mano en cada venta. Permisos propios (`ventas.view/view_all/create/edit/
  delete`); seed inicial: `dueña` (todo), rol `ventas` y `post_venta`
  (view+create+edit), `finanzas`/`operaciones` (view_all), `logistica`
  (view).
- **`tareas`** (ver `20260705000000_tareas.sql`): `entidad_tipo
  (lead/cliente/ticket), entidad_id, titulo, fecha_vencimiento, completada,
  owner_id, created_by`. Sin trigger de `updated_at` (columna con default
  `now()` pero no se actualiza sola). Desde `20260710000000_...` también
  tiene `notificada_vencida boolean` (evita duplicar el aviso de vencida,
  ver más abajo). `fecha_vencimiento` es `timestamptz` (fecha **y hora**):
  `TareaList.vue` (compartido clientes/leads/tickets) combina un
  `<input type="date">` + `<input type="time">` en un timestamp real vía
  `new Date(anio, mes-1, dia, horas, minutos).toISOString()`. Si se omite
  la hora, el default es **23:59 hora local** — no medianoche — para que
  una tarea "de hoy" no se marque vencida apenas empieza el día. Esa misma
  convención (23:59 local = "sin hora elegida") es la que decide si
  `formatearFecha` le muestra la hora al usuario o no.
- **`lead_interacciones`** (ver `20260705000100_lead_interacciones.sql`):
  `lead_id, canal (correo/texto/telefono), nota, created_by`.
- **`notificaciones`**: `usuario_id, tipo, entidad_tipo, entidad_id, mensaje,
  leida, created_at` + triggers de asignación (lead/ticket/tarea) + Realtime
  habilitado (`alter publication supabase_realtime add table notificaciones`).
  El tipo `tarea_vencida` se genera vía `pg_cron` (ver más abajo), no por
  trigger — "vencer" no es un evento de escritura.
- **`audit_log`**: `tabla, registro_id, usuario_id, accion, datos_anteriores,
  datos_nuevos` — UI en `/admin/auditoria` con filtros (usuario/tabla/acción/
  rango de fechas), paginación "Cargar más" y diff real de campos
  cambiados (ya no JSON crudo). Tablas auditadas: `clientes`, `leads`,
  `tickets`, `productos`, `ventas` (lista fija en el selector de la UI, no
  una consulta a la base).
- **`dashboard_widgets`/`user_dashboard_widgets`**: catálogo de widgets
  (KPI/chart) asignables por usuario. Incluye los widgets que antes vivían
  en `/reportes` (`kpi.total_leads`, `kpi.leads_ganados`,
  `kpi.leads_perdidos`, `kpi.tasa_conversion`, `chart.funnel_leads`,
  `chart.performance_vendedores`), todos con `resource='reportes'`.
- **`permissions`/`role_permissions`/`user_permission_overrides`**: tenían
  RLS activado pero sin políticas (solo accesibles antes vía RPCs security
  definer). Desde `20260709000000_rls_permisos_admin.sql` tienen policies
  de `select` (y `user_permission_overrides` también `insert/update/delete`)
  gateadas por `dashboard_widgets.assign`, para soportar `/admin/permisos`.
- **`kame_tokens`**: token OAuth de Kame ERP, expira cada 24h.

## Autenticación y arranque de la app

- Login custom en `pages/login.vue` (no el flujo default de `@nuxtjs/supabase`).
- Requiere `supabase: { redirect: false }` en `nuxt.config.ts` para no pelear
  con el redirect automático del módulo.
- `auth.global.ts` corre en todas las rutas; si la sesión viene de una cookie
  restaurada (F5, URL directa, pestaña nueva) y `login.vue` nunca corrió, este
  middleware es el que dispara la carga de permisos/superadmin/features/
  widgets/perfil. Cada composable expone su propio flag `cargado` para no
  repetir el trabajo en cada navegación.

## Gotchas críticos (no volver a pisar estos)

1. `useSupabaseUser()` devuelve el JWT decodificado — el id de usuario está en
   `.sub`, NO en `.id`.
2. Componentes/composables nuevos requieren `rm -rf .nuxt && npm run dev` —
   el hot-reload no alcanza.
3. `<component :is="stringName">` necesita un `componentMap` explícito
   importado a mano (ver `app/pages/index.vue`); el auto-import global de
   Nuxt no lo resuelve.
4. Instalar paquetes nuevos siempre con `--legacy-peer-deps`.
5. Nunca `@nuxt/eslint` + `@nuxtjs/eslint-module` juntos (ver sección Stack).
6. `nuxt-charts` → `BarChart` exige `y-axis`. Sin ella, `Error: yAxis is
   required` dentro del `setup()`, que puede dejar la navegación de Vue
   Router rota hasta recargar.
7. Views de Postgres sobre tablas con RLS: crear con
   `with (security_invoker = true)`, si no, el RLS de las tablas base no se
   aplica según quién consulta (`vista_funnel_leads`,
   `vista_performance_vendedores`).
8. Optimistic locking: columna `version` (autoincrementada por trigger
   `fn_incrementar_version()`) en `leads`, `clientes`, `tickets`, `productos`.
   `updateLead/updateCliente/updateTicket/updateProducto` aceptan
   `expectedVersion` opcional; si no matchea, `Error('CONFLICTO_VERSION')`,
   capturado en las páginas de detalle para recargar datos frescos. Los
   cambios de estado del Kanban (`cambiarEstado`) NO llevan este chequeo a
   propósito, para no complicar el drag & drop.
9. Antes de `npm install` con lockfile borrado: revisar typos de versión
   inexistente en `package.json` (pasó con `@nuxt/eslint@^3.0.4`, nunca
   existió; la real más reciente es `1.16.0`).
10. Cuando Claude crea archivos en su entorno de trabajo temporal, confirmar
    siempre que se entregaron y se subieron a git — ya pasó que archivos
    quedaron creados solo ahí sin llegar al repo real. Ante la duda, correr
    `git status --short` (archivos `??` = sin trackear, nunca commiteados).
11. `tareas.fecha_vencimiento`: **23:59 hora local es el sentinel de "sin
    hora elegida"**, no `null` ni ningún flag separado. Si algún día se
    necesita distinguir de verdad "sin hora" de "el usuario eligió 23:59
    a propósito", hace falta una columna nueva — hoy son indistinguibles
    a propósito (se descartó un heurístico basado en medianoche UTC por
    colisionar con tareas reales a las 20:00 en Chile, GMT-4).
12. `push` a `origin/master` requiere autenticación HTTPS interactiva que
    este entorno no puede resolver solo (no hay `gh` CLI ni credential
    helper configurado) — pedirle al usuario que lo corra él mismo.
13. Un recurso sin `owner_id` (ej. `productos`, catálogo compartido) no
    reimplementa la distinción propio/todos: `view` y `view_all` quedan
    equivalentes en la policy de RLS, pero se mantienen como permisos
    separados igual, solo por consistencia con la UI (que ya asume ese par
    en todos lados). No asumir que todo recurso nuevo necesita `owner_id`.
14. `storage.objects` no tiene noción de `owner_id`/propio-todos — las
    policies de Storage (ver bucket `clientes-imagenes`) solo pueden
    gatear por un permiso de escritura simple (`clientes.edit`), no por
    la distinción view/view_all que sí existe a nivel de fila en la tabla.

## Roadmap — estado actual

1. ✅ Pipeline visual de leads (Kanban, 6 estados, colores, drag & drop)
2. ✅ Timeline de interacciones (correo/texto/teléfono) por lead
3. ✅ Tareas y recordatorios (genérico leads/clientes/tickets), con selector
   de hora (`fecha_vencimiento` timestamptz, default 23:59 local, ver
   gotcha #11)
4. ✅ Reportes y analytics — la página `/reportes` (funnel + performance por
   vendedor) se **eliminó** y su contenido se convirtió en widgets
   asignables del dashboard (`kpi.total_leads`, `kpi.leads_ganados`,
   `kpi.leads_perdidos`, `kpi.tasa_conversion`, `chart.funnel_leads`,
   `chart.performance_vendedores`), gestionados desde `/admin/dashboards`
   igual que el resto de widgets.
5. ✅ Búsqueda global (clientes/leads/tickets, dropdown con debounce)
6. ✅ Importación/exportación CSV con deduplicación (rut / teléfono-email
   en clientes/leads, SKU en productos)
7. ✅ Notificaciones in-app (Realtime, campanita), incluyendo `tarea_vencida`
   vía `pg_cron` (job `notificar-tareas-vencidas`, corre cada hora)
8. 🟡 Auditoría — visor de `audit_log` en `/admin/auditoria` con diff real
   de campos cambiados (reemplazó el JSON crudo), filtros (usuario/tabla/
   acción/rango de fechas) y paginación "Cargar más". Sigue faltando el
   testing activo de seguridad de RLS (intentar escalar permisos, acceso
   cross-vendedor, etc.)
9. ⬜ Testing automatizado de `has_permission()` / permisos efectivos
10. 🟡 Documentación — este documento es la base; falta manual de uso por rol
    para la dueña y su equipo (no técnico)
11. ✅ Eliminar clientes/leads/tickets desde la UI — `deleteCliente`/
    `deleteLead`/`deleteTicket` (mismo patrón en los tres composables) +
    componente `SharedConfirmDialog` (modal de confirmación reutilizable,
    montado en un `Teleport` a `body`).
12. ✅ Gestión de overrides de permisos desde la UI (`/admin/permisos`) —
    antes solo se podía hacer a mano por SQL Editor. Habilitado por nuevas
    policies de `select`/`write` sobre `permissions`, `role_permissions` y
    `user_permission_overrides` (`20260709000000_rls_permisos_admin.sql`),
    gateadas por el mismo permiso `dashboard_widgets.assign`.
13. ✅ Notificación de `tarea_vencida` vía `pg_cron` —
    `fn_notificar_tareas_vencidas()` (`security definer`) corre cada hora,
    notifica una sola vez por tarea (columna `tareas.notificada_vencida`)
    a `coalesce(owner_id, created_by)`, con un trigger que resetea el flag
    si la tarea se reabre o se reprograma.
14. ✅ Selector de hora en tareas/recordatorios — `TareaList.vue` (compartido
    clientes/leads/tickets) agrega `<input type="time">` junto al de fecha,
    con el default 23:59-hora-local descrito en el gotcha #11.
15. ✅ Imagen de cliente — `ClienteForm.vue` sube a un bucket público de
    Storage (`clientes-imagenes`), `imagen_url` se muestra en los avatares.
    Bucket público a propósito (no son datos sensibles); escritura gateada
    por `clientes.edit`.
16. ✅ Vista de detalle de Clientes (panel dividido) — `/clientes` pasó de
    una tabla de solo lectura a `ClienteSplitView.vue` (lista + panel de
    detalle lado a lado).
17. ✅ Campo `direccion` en clientes.
18. ✅ Reorganización de vistas de detalle — leads a 3 columnas (pantalla
    completa), tickets a 2 columnas (`max-w-2xl`).
19. ✅ Sistema de design tokens (CSS custom properties) adoptado en
    `app/components/shared/` — reemplaza progresivamente los colores hex
    arbitrarios (`bg-[#1075B5]`) por tokens semánticos (`bg-primary`, etc.).
20. ✅ **Catálogo de Productos** (módulo nuevo completo) — tabla `productos`
    sin `owner_id` (catálogo compartido), CRUD completo, listado tipo tabla
    con búsqueda/filtros, import/export CSV, auditoría, optimistic locking,
    permisos propios (dueña por defecto), integrado a navegación. 561
    productos reales importados desde el Excel del usuario.
21. ✅ **Filtro por vendedor en Clientes** — `ClienteSplitView.vue` agrega un
    selector de vendedor asignado (`owner_id`) sobre la lista ya cargada,
    100% client-side (mismo patrón que el buscador de texto existente, no
    toca `useClientes.ts` ni RLS). Reutiliza `useUsuarios().fetchUsuarios()`,
    ya usado igual en `/admin/auditoria`.

## Pendientes sueltos

- Probar optimistic locking (dos pestañas, mismo registro) con usuarios reales.
- Segunda pasada de dedupe por `email` en importación de clientes sin RUT
  (`NULL` no deduplica contra otro `NULL` vía unique constraint).

## Otros proyectos relacionados (contexto de fondo, no parte de este repo)

- **Integrakin WordPress/WooCommerce**: tema custom `integrakin-theme`,
  SiteGround, repo `github.com/dozz1e/nuevo_integrakin`.
- **Integrakin n8n multi-agente**: Orquestador + Agente Kin + Agente
  Post-Venta, Gemini 2.5 Flash, Supabase pgvector, Gotenberg para PDFs.
- **MarSol Propiedades**: CRM propio (Astro + Vue), RAG legal chatbot.
- Integrakin usa **Kame ERP** (OAuth, token expira cada 24h) — este CRM lee
  de Kame vía n8n, sin write-back todavía.
