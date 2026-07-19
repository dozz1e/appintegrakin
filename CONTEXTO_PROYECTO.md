# Integrakin CRM — Contexto del proyecto

> Documento de referencia técnica, generado a partir de una inspección real
> del repo (no solo de memoria de chat). Útil para retomar el proyecto en una
> cuenta nueva de Claude (pegarlo como primer mensaje) o para cualquier
> desarrollador que se sume.
>
> Última actualización: 16 de julio de 2026 (editar/eliminar ventas +
> productos comprados en tickets).

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
20260713000600_tecnicos.sql
20260713000700_lead_interacciones_canales.sql
20260713000800_perfiles_avatar_settings.sql
20260713000900_perfiles_imagenes_storage.sql
20260714000000_multi_rol_usuarios.sql
20260714010000_tareas_descartadas.sql
20260714020000_permisos_efectivos_superadmin_bypass.sql
20260714030000_delete_notificaciones_propias.sql
20260714040000_cliente_interacciones.sql
20260714050000_citas_capacitacion.sql
20260714060000_citas_descartadas.sql
20260714070000_notificacion_capacitacion_asignada.sql
20260714080000_notificacion_citas_vencidas.sql
20260714200000_tickets_post_venta.sql
20260714210000_tickets_post_venta_seguimientos.sql
20260714220000_notificacion_tickets_post_venta_vencidos.sql
20260715000000_historial_estados.sql
20260715010000_cierre_archivado.sql
20260715020000_configuracion_archivado.sql
20260715030000_cron_archivar_cerrados.sql
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
admin/usuarios/index.vue       — asignar/quitar roles múltiples por usuario
                                  (profile_roles), gateada por
                                  dashboard_widgets.assign. Nadie edita sus
                                  propios roles acá salvo que sea superadmin
                                  (ver Modelo de permisos)
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
capacitaciones/index.vue       — agenda de capacitaciones (lista + filtro de fecha)
post-venta/index.vue           — kanban de tickets post-venta (7 estados)
post-venta/[id].vue            — detalle con cambio de estado + bitácora de seguimiento
leads/historial-movimientos.vue    — todos los cambios de estado de leads
leads/cerrados.vue                 — leads ganados/perdidos, histórico completo
tickets/historial-movimientos.vue  — todos los cambios de estado de tickets
tickets/cerrados.vue               — tickets resueltos/cerrados, histórico completo
post-venta/historial-movimientos.vue — cambios de estado de tickets post-venta
post-venta/cerrados.vue            — tickets despachados, histórico completo
```
Nota: `reportes/index.vue` **ya no existe** — se eliminó y su contenido
(funnel + performance por vendedor) se convirtió en widgets asignables del
dashboard (ver sección Roadmap).

### Composables (`app/composables/`)
```
useAuditoria, useAuth, useBusquedaGlobal, useCitasCapacitacion,
useClienteInteracciones, useClientes, useConfiguracionArchivado, useCsv,
useDashboardWidgets, useEntidadImagenes, useErrorLog, useFeatures,
useHistorialEstados, useLeadInteracciones, useLeads, useMiPerfil,
useNotificaciones, usePermisosOverrides, usePermissions, useProductos,
useReportes, useRolesUsuario, useSuperadmin, useTareas, useTecnicos,
useTicketsPostVenta, useTickets, useToast, useUsuarios, useVentas
```

### Componentes (`app/components/`)
```
capacitaciones/CitaForm.vue
clientes/ClienteBuscador.vue, clientes/ClienteForm.vue,
        clientes/ClienteInteraccionTimeline.vue, clientes/ClienteSplitView.vue,
        clientes/VentaList.vue
leads/LeadForm.vue, leads/LeadKanban.vue, leads/LeadTimeline.vue
post-venta/SeguimientoTimeline.vue, post-venta/TicketBoard.vue, post-venta/TicketForm.vue
tickets/TicketBoard.vue, tickets/TicketForm.vue
productos/ProductoForm.vue, productos/ProductoBuscador.vue
shared/AppLogo, Avatar, Badge, Card, ConfiguracionModal, ConfirmDialog,
       GaleriaImagenes, GlobalSearch, Modal, NavLink, NotificationBell,
       PageHeader, PerfilModal, RecordatorioAlert, RecordatorioAlertContainer,
       TareaList, TextoExpandible, ToastContainer, UserMenu
widgets/ChartFunnelLeads, ChartLeadsPorEstado, ChartPerformanceVendedores,
        KpiCard, KpiClientesTotales, KpiLeadsActivos, KpiLeadsGanados,
        KpiLeadsPerdidos, KpiTasaConversion, KpiTicketsAbiertos, KpiTotalLeads
```
Nota: `clientes/ClienteTable.vue` fue reemplazado por
`clientes/ClienteSplitView.vue` (vista de detalle en panel dividido, ver
Roadmap). Los widgets de KPI/chart de `reportes` (`ChartFunnelLeads`,
`ChartPerformanceVendedores`, `KpiLeadsGanados`, `KpiLeadsPerdidos`,
`KpiTotalLeads`) son nuevos, agregados al convertir `/reportes` en widgets.
`RecordatorioAlert`/`RecordatorioAlertContainer` son el popup flotante de
"tarea próxima/vencida" (distinto de la campanita `NotificationBell`, ver
Roadmap).

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

RBAC multi-rol + overrides individuales + ReBAC simple:

- **Multi-rol desde 20260714000000_multi_rol_usuarios.sql**: `profiles.role_id`
  (FK única) **se eliminó**. Reemplazado por `profile_roles(profile_id,
  role_id)` many-to-many — un usuario puede tener varios roles a la vez, sus
  permisos son la unión de los permisos de todos. UI en `/admin/usuarios`
  (`useRolesUsuario.ts`: `asignarRol`/`quitarRol`/`fetchCatalogoRoles`).
  **No** asumir que `profiles` sigue teniendo `role_id` — cualquier código o
  memoria vieja que lo mencione está desactualizado.
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
  — firma con 3 argumentos separados. Bypasea todo si el usuario está en
  `superadmins`.
- `permisos_efectivos_usuario(p_user uuid) returns table(resource text, action text)`
  — usada por el frontend (`usePermissions.ts`) para armar la lista de
  permisos y renderizar el nav. **Desde 20260714020000 también bypasea
  superadmin** (devuelve todas las filas de `permissions`); antes no lo
  hacía (a diferencia de `has_permission`), y se disimulaba mientras el
  superadmin también tuviera un rol de negocio con todos los permisos — al
  sacarle ese rol, el nav quedaba vacío. Ver gotcha #15.
- Patrón en páginas: `definePageMeta({ middleware: 'permission', permiso: {
  resource: 'x', actions: ['view','view_all'] } })`; `can(resource, action)`
  desde `usePermissions()` para gating en templates/sidebar.
- `/admin/usuarios` y `/admin/permisos` bloquean editar los propios roles
  (evita que alguien se quite a sí mismo el único rol con
  `dashboard_widgets.assign`) — **excepto si es superadmin**, que no corre
  ese riesgo porque bypasea permisos vía `superadmins` sin depender de
  `profile_roles`.

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
  `productos`) — RLS igual que `tickets` (propio vs `view_all`). UI: pestaña
  "Ventas" en `ClienteSplitView.vue`, formulario de alta con edición y
  borrado inline (mismo patrón que `TareaList.vue`), gateado por
  `can('ventas','edit'/'delete')`. Sin precio de lista en `productos` — el
  valor se tipea a mano en cada venta. Permisos propios (`ventas.view/
  view_all/create/edit/delete`); seed inicial: `dueña` (todo), rol `ventas`
  y `post_venta` (view+create+edit, sin delete), `finanzas`/`operaciones`
  (view_all), `logistica` (view).
- **`ticket_productos`** (ver `20260716060000_ticket_productos.sql`):
  relación muchos a muchos entre `tickets` (servicio técnico, no
  `tickets_post_venta`) y `productos` — un ticket puede tener varios
  productos comprados asociados. `ticket_id, producto_id, created_by,
  created_at`, unique del par. RLS en cascada igual patrón que
  `entidad_imagenes`: la condición reusa las reglas de
  `tickets_select`/`tickets_update` contra la fila padre, sin trigger de
  auditoría propio.
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
  `useTareas().fetchMisTareasPendientes()` filtra explícitamente por
  `owner_id` (o `created_by` si no tiene owner), el mismo criterio de
  responsable que usa `fn_notificar_tareas_vencidas`. **No confiar solo en
  RLS acá**: la policy de `select` en `tareas` permite `view_all`, así que
  sin este filtro explícito un superadmin o rol con `tareas.view_all` veía
  el popup `RecordatorioAlert` con avisos de tareas de todos, no solo las
  propias.
- **`lead_interacciones`** (ver `20260705000100_lead_interacciones.sql`, canal
  actualizado en `20260713000700_lead_interacciones_canales.sql`): `lead_id,
  canal (whatsapp/instagram/facebook/llamada/web/correo), nota, created_by`.
- **`cliente_interacciones`** (ver `20260714040000_cliente_interacciones.sql`,
  mismo concepto que `lead_interacciones` pero para clientes ya convertidos):
  `cliente_id, canal (mismo set que lead_interacciones), nota, created_by`.
  UI: tab "Interacciones" en `ClienteSplitView.vue`
  (`ClienteInteraccionTimeline.vue`, mismo patrón que `LeadTimeline.vue`).
  `useClienteInteracciones().fetchUltimasInteracciones()` arma un mapa
  `cliente_id -> fecha` (última interacción de cada uno, reducido
  client-side) usado para la columna "Últ. interacción" en la lista y para
  los filtros de antigüedad (7/15/30/60+ días, "nunca contactados") y rango
  desde/hasta.
- **`tareas_descartadas`**/**`citas_descartadas`** (ver
  `20260714010000_tareas_descartadas.sql`,
  `20260714060000_citas_descartadas.sql`): `user_id, tarea_id/cita_id` —
  descarte del popup `RecordatorioAlert` (botón ✕), por usuario. Reemplaza
  el enfoque anterior de `localStorage` (commit `03d34c6`): ese no
  persistía en incógnito ni entre dispositivos porque el storage es por
  navegador, no por cuenta. Desde
  `20260716030000_umbral_tier_dismiss.sql` también tienen
  `umbral_minutos` (parte de la PK compuesta): el descarte es por
  **umbral cruzado** (`0` = ya vencida), no por tarea/cita entera —
  cerrar el aviso de "1 hora antes" no apaga el de "15 min antes" que
  viene después. Umbrales configurables por usuario en
  `profiles.settings.umbrales_alertas` (array de `{valor, unidad}`,
  unidad `minutos`/`horas`/`dias`; default `30 min` si no se configuró
  nada), leídos por `useUmbralesAlertas.ts` (ver spec
  `2026-07-16-multiples-umbrales-alertas-design.md`).
- **`notificaciones`**: `usuario_id, tipo, entidad_tipo, entidad_id, mensaje,
  leida, created_at` + triggers de asignación (lead/ticket/tarea) + Realtime
  habilitado (`alter publication supabase_realtime add table notificaciones`).
  El tipo `tarea_vencida` se genera vía `pg_cron` (ver más abajo), no por
  trigger — "vencer" no es un evento de escritura. Desde
  `20260714030000_delete_notificaciones_propias.sql` también se pueden
  **borrar** las propias (botón ✕ en `NotificationBell.vue`,
  `eliminarNotificacion()`), no solo marcar leídas.
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
- **`entidad_imagenes`** (ver `20260716020000_entidad_imagenes.sql`): galería
  genérica (varias imágenes por registro, a diferencia de
  `clientes.imagen_url` que es una sola): `entidad_tipo
  ('cliente_interaccion'|'lead_interaccion'|'ticket'|'ticket_post_venta'),
  entidad_id, url, created_by`. RLS no usa `has_permission` directo (una
  tabla, cuatro tipos de padre distintos) - cada policy verifica que la
  fila padre exista, lo que cascada a través del RLS de esa tabla padre.
  Bucket público `entidad-imagenes` (mismo criterio que
  `clientes-imagenes`), escritura solo exige estar autenticado porque
  Storage no distingue a qué entidad pertenece cada archivo (ver gotcha
  #14). Borrado solo de las imágenes propias (`created_by = auth.uid()`).
  UI: `SharedGaleriaImagenes.vue` (grid de miniaturas + upload + preview +
  borrar), en interacciones de clientes/leads y en la ficha de tickets
  (servicio técnico y post-venta).
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
15. Bypass de superadmin: `has_permission()` y `permisos_efectivos_usuario()`
    son dos funciones separadas y **cada una necesita su propio chequeo de
    `superadmins`** — no alcanza con agregarlo a una sola. Ya pasó que
    `permisos_efectivos_usuario` (la que arma el nav del frontend) no lo
    tenía, y se disimulaba mientras el superadmin también tuviera un rol de
    negocio con todos los permisos asignado en `profile_roles`. Si se agrega
    una función nueva de este estilo ("qué puede hacer/ver este usuario"),
    replicar el mismo chequeo `if exists (select 1 from superadmins where
    user_id = p_user) then ...`.
16. `fetchMisTareasPendientes`/cualquier "mis X" del frontend: no alcanza con
    dejar que RLS filtre solo por `view_all` — si el permiso existe (rol o
    superadmin), RLS deja pasar filas de **todos**, no solo las propias.
    Cuando la intención es "lo mío" (ej. el popup de recordatorios), filtrar
    explícitamente por `owner_id`/`created_by` en la query, sin depender de
    que RLS lo acote.
17. `TG_OP` dentro de un trigger de Postgres siempre viene en MAYÚSCULA
    (`'INSERT'`/`'UPDATE'`/`'DELETE'`) — comparar contra literales en
    minúscula (`tg_op in ('update','delete')`) nunca matchea. Este bug
    exacto tuvo `registrar_auditoria()` desde su creación
    (`20260702000800_audit_log.sql`) y dejó `datos_anteriores`/
    `datos_nuevos` en `NULL` en el 100% de los ~4400 registros históricos
    de `audit_log` — pasó desapercibido porque la columna `accion` sí se
    guardaba bien (usa `lower(tg_op)` directo). Fix en
    `20260716010000_fix_registrar_auditoria_tg_op.sql`. Si se escribe
    lógica nueva basada en `tg_op`, comparar en mayúscula o pasarlo por
    `lower()`/`upper()` primero, nunca asumir el casing.
18. Supabase `.delete()` (y `.update()`) **no tira error cuando RLS
    bloquea la operación** — 0 filas afectadas es un resultado válido sin
    `error`, así que si el frontend no revisa filas afectadas, muestra
    "eliminado" con éxito mientras la fila sigue intacta en la base
    (reaparece al recargar). Pasó con `eliminarInteraccion` en
    `useClienteInteracciones.ts`/`useLeadInteracciones.ts`: la policy de
    `delete` solo dejaba borrar a `created_by = auth.uid()`, sin
    excepción para otros roles, y nadie lo notó hasta que alguien
    intentó borrar una interacción ajena. Fix en
    `20260716040000_fix_delete_interacciones_permiso.sql` (agrega
    `has_permission(..., 'clientes'/'leads', 'edit')` a la policy) +
    encadenar `.select()` al `.delete()` en el composable y chequear
    `data.length === 0` para tirar error explícito. Si se agrega un
    delete nuevo en cualquier tabla, aplicar el mismo patrón
    (`.select()` + chequeo de filas) y no asumir que "sin error" significa
    "se borró".
19. `defineProps<{ x?: boolean }>()` sin `withDefaults`: Vue le pone
    `default: false` automáticamente a props boolean opcionales (no
    queda `undefined` cuando no se pasa el prop). Un `v-if="x !== false"`
    pensado para "default true si no se pasa" **no funciona** — siempre
    da `false`. Pasó con `permitirAgregar` en `GaleriaImagenes.vue`: al
    agregarle el prop para ocultar el botón en las timelines de
    interacciones, quedó en `false` también en tickets/post-venta (que
    nunca lo pasan) sin que nadie lo pidiera — silencioso, sin error en
    consola. Fix: `withDefaults(defineProps<...>(), { permitirAgregar: true })`.
    Si se agrega un prop boolean opcional que debe ser `true` por
    defecto, usar siempre `withDefaults`, nunca un chequeo `!== false`
    contra el valor crudo del prop.

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
    ya usado igual en `/admin/auditoria`. Desde hoy, oculto para roles sin
    `clientes.view_all` (solo el rol `ventas` no lo tiene) — antes lo veían
    todos aunque solo tuvieran acceso a sus propios clientes.
22. ✅ **Multi-rol de usuarios** — `profiles.role_id` (uno a uno) reemplazado
    por `profile_roles` (muchos a muchos, ver Modelo de permisos). Pantalla
    `/admin/usuarios` para asignar/quitar roles múltiples
    (`useRolesUsuario.ts`).
23. ✅ **Descarte de `RecordatorioAlert` persistido server-side** — tabla
    `tareas_descartadas` reemplaza el `localStorage` anterior, que no
    persistía en incógnito ni entre dispositivos.
24. ✅ **Fix bypass de superadmin en `permisos_efectivos_usuario`** — antes
    solo `has_permission` bypaseaba; un superadmin sin rol de negocio
    asignado veía el nav completamente vacío (ver gotcha #15).
25. ✅ **Notificaciones borrables** — botón ✕ en `NotificationBell.vue`,
    policy de `delete` propia agregada.
26. ✅ **Tabs de `ClienteSplitView` rediseñadas** — de texto subrayado a
    botones píldora con `bg-primary`/`text-ink-onprimary` en la pestaña
    activa.
27. ✅ **Interacciones de clientes + última interacción** — tabla
    `cliente_interacciones` (mismo concepto que `lead_interacciones`), tab
    "Interacciones" en el detalle, columna "Últ. interacción" en la lista,
    y filtros por antigüedad y por rango de fechas (ver schema más arriba).
28. ✅ **Agenda de capacitaciones** — módulo nuevo completo para el rol
    `capacitaciones` (antes placeholder sin permisos). Tabla
    `citas_capacitacion` (cliente + producto obligatorios, sin
    recurrencia), notificación al asignar responsable + cron de
    vencidas (mismo patrón que tareas), popup `RecordatorioAlert`
    generalizado para mostrar tareas y citas juntas. Página
    `/capacitaciones` con lista y filtro de fecha (sin calendario
    visual — ver spec `2026-07-14-agenda-capacitaciones-design.md`).
29. ✅ **Tickets de post-venta** — sistema propio para el equipo de
    post_venta (reparación/garantía de equipos), separado del `tickets`
    de servicio_técnico. Tabla `tickets_post_venta` sin `owner_id` (todo
    el equipo ve/edita todo por igual), cliente opcionalmente "no
    registrado" (campos libres en la misma fila, sin tabla aparte),
    bitácora de seguimiento (`tickets_post_venta_seguimientos`), cron de
    vencidos que notifica a todo el rol `post_venta` (broadcast, no
    owner individual). Página `/post-venta` con Kanban de 7 estados +
    detalle con bitácora (ver spec
    `2026-07-14-tickets-post-venta-design.md`).
30. ✅ **Historial de estados y archivado automático** — tabla genérica
    `historial_estados` (patrón `entidad_tipo`/`entidad_id`) con trigger
    en `leads`/`tickets`/`tickets_post_venta`; columnas `fecha_cierre`/
    `archivado` gestionadas por trigger de cierre propio de cada tabla;
    cron diario `fn_archivar_cerrados` que archiva (nunca borra) usando
    días configurables por módulo en `configuracion_archivado` (valor
    global, no por usuario). 6 páginas nuevas (historial de movimientos +
    historial de cerrados, por módulo) y reestructura del nav (Leads/
    Servicio Técnico/Post Venta como secciones propias). Días editables
    desde el modal de Configuración, visible solo para cuentas con rol
    `post_venta` (ver spec
    `2026-07-15-historial-estados-archivado-design.md`).
31. ✅ **Galería de imágenes en interacciones y tickets** — tabla genérica
    `entidad_imagenes` + bucket `entidad-imagenes`, varias imágenes por
    registro (ver schema más arriba). Cubre interacciones de clientes y
    leads, y ambos tickets (servicio técnico y post-venta, este último el
    caso de uso principal: evidencia de falla/daño del equipo).
32. ✅ **Permiso `ventas.view_all` para Natalia Quevedo (líder de
    vendedoras)** — override individual en `user_permission_overrides`
    (no rol nuevo, caso único). Además, selector de vendedor en
    `/leads` (`app/pages/leads/index.vue`), mismo patrón client-side que
    el filtro de `/clientes` (ver punto 21), gateado por
    `can('leads', 'view_all')` (ver spec
    `2026-07-16-natalia-permisos-filtro-leads-design.md`).
33. ✅ **Múltiples umbrales configurables en `RecordatorioAlert`** — antes
    un solo umbral fijo por usuario (30 min), ahora una lista de
    umbrales en días/horas/minutos (`profiles.settings.umbrales_alertas`),
    con descarte independiente por umbral cruzado (ver schema de
    `tareas_descartadas`/`citas_descartadas` más arriba y spec
    `2026-07-16-multiples-umbrales-alertas-design.md`).
34. ✅ **Editar/eliminar ventas + campo valor** — `VentaList.vue` pasó de
    solo-alta a permitir editar (producto/fecha/valor) y eliminar,
    mismo patrón inline que `TareaList.vue`, gateado por
    `can('ventas','edit'/'delete')`. De paso se agregó el input de
    `valor` que faltaba en el form (antes `crearVenta` siempre recibía
    `0` hardcodeado) y se reemplazó el buscador de producto hecho a
    mano por el componente compartido `ProductosProductoBuscador`.
35. ✅ **Productos comprados en tickets de servicio técnico** — tabla
    nueva `ticket_productos` (ver schema arriba). Al elegir/tener
    cliente en `TicketForm.vue` aparecen chips de productos que compró
    (misma fuente que el picker de post-venta, `fetchVentasPorCliente`)
    pero de selección múltiple; se asocian al crear el ticket y se
    puede agregar/quitar al editarlo (ver spec
    `2026-07-16-ventas-editar-eliminar-ticket-productos-design.md`).
36. ✅ **Asignar clientes por vendedor** — permiso nuevo `clientes.assign`
    (dueña + override individual de Natalia Quevedo, superadmin bypasea)
    que en `clientes_update` actúa como bypass total (a diferencia de
    `clientes.edit`, no requiere ser dueño del cliente ni `view_all`).
    Selector editable "Vendedor asignado" en la tab Información de
    `ClienteSplitView.vue`, reusa la misma lista de vendedores (rol
    `ventas`) que ya trae el filtro de solo lectura existente.

## Pendientes sueltos

- Probar optimistic locking (dos pestañas, mismo registro) con usuarios reales.
- Testing de seguridad de RLS (escalar permisos, acceso cross-vendedor) y
  testing automatizado de `has_permission()`/permisos efectivos (puntos 8-9
  del Roadmap).
- Manual de uso por rol para la dueña y su equipo, no técnico (punto 10).
- **Responsive, fase 2 y 4** (fase 1 shell y fase 3 Kanban ya completas,
  ver specs `2026-07-16-responsive-shell-design.md` y
  `2026-07-16-responsive-kanban-design.md`) — falta: tablas/listados
  (clientes, productos, admin, etc.) en pantalla angosta (fase 2);
  formularios/modales y vistas de detalle multi-columna
  (`ClienteSplitView`, leads 3 columnas, tickets 2 columnas) colapsando
  a 1 columna (fase 4).

### Cosas que el usuario debe pedir/recopilar (no son código, son recordatorios)
- Definir email marketing (evaluación pendiente — falta elegir ESP por
  costos/API antes de diseñar nada).
- Pedir valores de mantención de cada producto.
- Pedir manuales de cada producto.
- Pedir/grabar video de capacitación por producto.

## Otros proyectos relacionados (contexto de fondo, no parte de este repo)

- **Integrakin WordPress/WooCommerce**: tema custom `integrakin-theme`,
  SiteGround, repo `github.com/dozz1e/nuevo_integrakin`.
- **Integrakin n8n multi-agente**: Orquestador + Agente Kin + Agente
  Post-Venta, Gemini 2.5 Flash, Supabase pgvector, Gotenberg para PDFs.
- **MarSol Propiedades**: CRM propio (Astro + Vue), RAG legal chatbot.
- Integrakin usa **Kame ERP** (OAuth, token expira cada 24h) — este CRM lee
  de Kame vía n8n, sin write-back todavía.
