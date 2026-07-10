# Integrakin CRM — Contexto del proyecto

> Documento de referencia técnica, generado a partir de una inspección real
> del repo (no solo de memoria de chat). Útil para retomar el proyecto en una
> cuenta nueva de Claude (pegarlo como primer mensaje) o para cualquier
> desarrollador que se sume.
>
> Última actualización: 10 de julio de 2026.

## Stack y dependencias reales

- **Framework:** Nuxt 4.4.8 — todo bajo `app/` (pages, components, composables,
  middleware, layouts, types); `server/` y `supabase/` quedan en la raíz.
- **Vue:** 3.5.38 · **vue-router:** 5.1.0
- **Base de datos:** Supabase (`@nuxtjs/supabase` 2.0.9) — Postgres + RLS +
  Realtime.
- **Hosting:** Vercel (`@vercel/analytics` 2.0.1, `@vercel/speed-insights` 2.0.0).
- **Estilos:** `@nuxtjs/tailwindcss` 6.14.0, colores arbitrarios
  (`bg-[#1075B5]`), sin tocar `tailwind.config`.
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
```
Nota: las 5 migraciones desde `tareas` hasta `notificaciones_realtime` se
crearon originalmente a mano en el SQL Editor de Supabase; ya quedaron
versionadas (esquema/funciones/triggers extraídos de la base real vía
`information_schema`/`pg_constraint`/`pg_policies`/`pg_trigger`/`pg_proc`,
no reaplicadas contra prod porque ya existen ahí). Aún faltaba comitear los
archivos al repo — ver `git status` si esto sigue pendiente.

### Páginas (`app/pages/`)
```
403.vue                        — página de acceso denegado
login.vue                      — login (ruta pública, ver auth.global.ts)
index.vue                      — dashboard con widgets por usuario
admin/auditoria/index.vue      — visor de audit_log (permiso auditoria.view_all)
admin/dashboards/index.vue     — asignación de dashboard_widgets por usuario (dueña)
panel-dev/index.vue            — panel superadmin: features, errores, usuarios
clientes/index.vue             — listado + import/export CSV
clientes/[id].vue              — detalle/edición (optimistic locking)
clientes/nuevo.vue
leads/index.vue                — Kanban (LeadKanban) + import/export CSV
leads/[id].vue                 — detalle + timeline de interacciones + tareas
leads/nuevo.vue
tickets/index.vue              — Kanban (TicketBoard)
tickets/[id].vue               — detalle (optimistic locking)
tickets/nuevo.vue
reportes/index.vue             — funnel + performance por vendedor
```

### Composables (`app/composables/`)
```
useAuditoria, useAuth, useBusquedaGlobal, useClientes, useCsv,
useDashboardWidgets, useErrorLog, useFeatures, useLeadInteracciones,
useLeads, useMiPerfil, useNotificaciones, usePermissions,
useReportes, useSuperadmin, useTareas, useTickets,
useToast, useUsuarios
```

### Componentes (`app/components/`)
```
clientes/ClienteForm.vue, clientes/ClienteTable.vue
leads/LeadForm.vue, leads/LeadKanban.vue, leads/LeadTimeline.vue
tickets/TicketBoard.vue, tickets/TicketForm.vue
shared/AppLogo, Avatar, Badge, Card, ConfirmDialog, GlobalSearch,
       NotificationBell, PageHeader, TareaList, ToastContainer
widgets/ChartLeadsPorEstado, KpiCard, KpiClientesTotales, KpiLeadsActivos,
        KpiTasaConversion, KpiTicketsAbiertos
```

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
  excepciones individuales (grant/revoke) por encima del rol. **No hay
  pantalla de UI para gestionar esto todavía** — se hace a mano por SQL.
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

   **El acceso a una página completa (ej. `/reportes`) se controla por el
   sistema de permisos normal, NO por este catálogo.** Ya nos confundimos una
   vez con esto — son mecanismos independientes.

## Schema real de las tablas principales

- **`leads`**: `nombre, telefono, email, origen, estado, cliente_id, owner_id,
  created_by, version, created_at, updated_at`. Estados
  (`leads_estado_check`): `nuevo, contactado, cotizado, negociacion, ganado,
  perdido` (6 estados — incluye `negociacion` entre `cotizado` y `ganado`).
- **`clientes`**: `rut (unique, nullable), razon_social, nombre_contacto,
  telefono, email, kame_id, owner_id, created_by, version`. No tiene `nombre`
  (usa `razon_social`) ni `direccion`.
- **`tickets`**: `cliente_id, titulo, descripcion, estado, prioridad,
  owner_id, created_by, version`. Estados (`tickets_estado_check`): `abierto,
  en_proceso, esperando_cliente, resuelto, cerrado`. Prioridad: `baja, media,
  alta, urgente`.
- **`tareas`** (ver `20260705000000_tareas.sql`): `entidad_tipo
  (lead/cliente/ticket), entidad_id, titulo, fecha_vencimiento, completada,
  owner_id, created_by`. Sin trigger de `updated_at` (columna con default
  `now()` pero no se actualiza sola).
- **`lead_interacciones`** (ver `20260705000100_lead_interacciones.sql`):
  `lead_id, canal (correo/texto/telefono), nota, created_by`.
- **`notificaciones`**: `usuario_id, tipo, entidad_tipo, entidad_id, mensaje,
  leida, created_at` + triggers de asignación (lead/ticket/tarea) + Realtime
  habilitado (`alter publication supabase_realtime add table notificaciones`).
  Falta el tipo `tarea_vencida` (requiere cron, no trigger — ver pendientes).
- **`audit_log`**: `tabla, registro_id, usuario_id, accion, datos_anteriores,
  datos_nuevos` — ya tiene UI de consulta en `/admin/auditoria`.
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
   `fn_incrementar_version()`) en `leads`, `clientes`, `tickets`.
   `updateLead/updateCliente/updateTicket` aceptan `expectedVersion` opcional;
   si no matchea, `Error('CONFLICTO_VERSION')`, capturado en las páginas de
   detalle para recargar datos frescos. Los cambios de estado del Kanban
   (`cambiarEstado`) NO llevan este chequeo a propósito, para no complicar el
   drag & drop.
9. Antes de `npm install` con lockfile borrado: revisar typos de versión
   inexistente en `package.json` (pasó con `@nuxt/eslint@^3.0.4`, nunca
   existió; la real más reciente es `1.16.0`).
10. Cuando Claude crea archivos en su entorno de trabajo temporal, confirmar
    siempre que se entregaron y se subieron a git — ya pasó que archivos
    quedaron creados solo ahí sin llegar al repo real. Ante la duda, correr
    `git status --short` (archivos `??` = sin trackear, nunca commiteados).

## Roadmap — estado actual

1. ✅ Pipeline visual de leads (Kanban, 6 estados, colores, drag & drop)
2. ✅ Timeline de interacciones (correo/texto/teléfono) por lead
3. ✅ Tareas y recordatorios (genérico leads/clientes/tickets)
4. ✅ Reportes y analytics (funnel + performance por vendedor)
5. ✅ Búsqueda global (clientes/leads/tickets, dropdown con debounce)
6. ✅ Importación/exportación CSV con deduplicación (rut / teléfono-email)
7. ✅ Notificaciones in-app (Realtime, campanita) — falta `tarea_vencida` (cron)
8. 🟡 Auditoría — ya existe **visor** de `audit_log` en `/admin/auditoria`,
   pero falta el testing activo de seguridad de RLS (intentar escalar
   permisos, acceso cross-vendedor, etc.)
9. ⬜ Testing automatizado de `has_permission()` / permisos efectivos
10. 🟡 Documentación — este documento es la base; falta manual de uso por rol
    para la dueña y su equipo (no técnico)
11. ✅ Eliminar clientes/leads/tickets desde la UI — `deleteCliente`/
    `deleteLead`/`deleteTicket` (mismo patrón en los tres composables) +
    componente `SharedConfirmDialog` (modal de confirmación reutilizable,
    montado en un `Teleport` a `body`). Clientes: eliminar desde el listado
    (`ClienteTable.vue`) y desde el detalle, con manejo especial del error
    de foreign key (`e.code === '23503'`, cliente con leads/tickets
    asociados) en ambas páginas. Leads y tickets: solo desde el detalle
    (no hay tabla de listado, son Kanban), sin caso especial de FK — nada
    bloquea su borrado. Ninguna de las tres entidades limpia
    `tareas`/`notificaciones` huérfanas al eliminar (decisión explícita del
    spec, ver `docs/superpowers/specs/2026-07-09-eliminar-*-design.md`).

## Pendientes sueltos

- Probar optimistic locking (dos pestañas, mismo registro) con usuarios reales.
- Notificación de `tarea_vencida` vía cron (pg_cron o job externo que revise
  `fecha_vencimiento < now() and completada = false`).
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
