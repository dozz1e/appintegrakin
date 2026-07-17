# Graph Report - /run/media/Respaldo/Trabajo/claude/appintegrakin  (2026-07-17)

## Corpus Check
- 250 files · ~166,439 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1225 nodes · 1335 edges · 129 communities (90 shown, 39 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 91 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Admin Permisos Page
- Components Tickets Ticketform
- Components Post Venta
- Components Post Venta
- Pages Capacitaciones Index
- Components Shared Configuracionmodal
- Pages Admin Auditoria
- Components Clientes Ventalist
- Components Clientes Clientesplitview
- Components Shared Tarealist
- Components Clientes Clienteinteracciontimeline
- Components Leads Leadtimeline
- Components Clientes Clienteform
- Pages Productos Index
- Pages Tickets Id
- Components Capacitaciones Calendariomes
- Components Shared Galeriaimagenes
- Composables Usebusquedaglobal
- Pages Leads Index
- Pages Clientes Index
- Pages Panel Dev
- Components Shared Notificationbell
- Components Shared Perfilmodal
- Pages Admin Permisos
- Pages Leads Id
- Pages Admin Usuarios
- Pages Post Venta
- Components Shared Recordatorioalertcontainer
- Pages Post Venta
- Components Productos Productobuscador
- Components Widgets Chartfunnelleads
- Eslint
- Components Clientes Clientebuscador
- Pages Tickets Nuevo
- Components Shared Globalsearch
- Pages Admin Dashboards
- Pages Productos Index
- Pages Login
- Docs Superpowers Specs 2026
- Components Shared Usermenu
- Components Widgets Kpitasaconversion
- Docs Superpowers Specs 2026
- Docs Superpowers Specs 2026
- Components Productos Productoform
- Components Widgets Chartperformancevendedores
- Utils Estadocolores
- Docs Superpowers Specs 2026
- Components Leads Leadform
- Pages Index
- Pages Leads Historial
- Pages Post Venta
- Pages Tickets Historial
- Docs Superpowers Specs 2026
- Components Shared Textoexpandible
- Package
- Package Scripts
- Composables Usemiperfil
- Composables Useusuarios
- Pages Leads Cerrados
- Pages Post Venta
- Pages Tickets Cerrados
- Docs Superpowers Specs 2026
- Iconify Json Mdi
- Components Shared Toastcontainer
- Components Widgets Kpiclientestotales
- Components Widgets Kpileadsactivos
- Components Widgets Kpileadsganados
- Components Widgets Kpileadsperdidos
- Components Widgets Kpiticketsabiertos
- Components Widgets Kpitotalleads
- Composables Useconfiguracionarchivado
- Composables Usedashboardwidgets
- Composables Useentidadimagenes
- Composables Usefeatures
- Composables Usehistorialestados
- Composables Usepermisosoverrides
- Composables Useproductos
- Composables Usereportes
- Composables Usetoast
- Docs Superpowers Specs 2026
- Docs Superpowers Specs 2026
- Scripts Seed Usuarios
- Components Clientes Clientesplitview
- Composables Useclienteinteracciones
- Composables Useerrorlog
- Composables Useleadinteracciones
- Composables Usenotificaciones
- Composables Usepermissions
- Composables Userolesusuario
- Composables Usetecnicos
- Types Router D
- Tsconfig
- Components Shared Navlink
- Middleware Auth Global
- Middleware Permission
- Docs Superpowers Specs 2026
- Docs Superpowers Specs 2026
- Nuxt Charts
- Nuxt Clarity Analytics
- Nuxt Eslint
- Nuxt Icon
- Nuxt Image
- Nuxtjs Google Fonts
- Nuxtjs Tailwindcss
- Package Dependencies Papaparse
- Package Dependencies Pinia Nuxt
- Package Dependencies Vercel Analytics
- Package Dependencies Vercel Speed
- Package Dependencies Vue
- Assets Images Logo
- Public Robots Doc

## God Nodes (most connected - your core abstractions)
1. `error` - 53 edges
2. `CONTEXTO_PROYECTO.md — Integrakin CRM reference doc` - 25 edges
3. `Tickets de Post-venta — design spec` - 11 edges
4. `Plan: Agenda de Capacitaciones` - 10 edges
5. `Plan: Multi-rol de usuarios` - 9 edges
6. `Plan: Historial de estados y archivado automático` - 9 edges
7. `Plan: Editar/eliminar ventas + productos comprados en tickets` - 9 edges
8. `Agenda de capacitaciones — design spec` - 9 edges
9. `Editar/eliminar ventas + productos comprados en tickets — design spec` - 9 edges
10. `Plan: Tickets de Post-venta` - 8 edges

## Surprising Connections (you probably didn't know these)
- `onGuardarEdicion()` --calls--> `error`  [INFERRED]
  app/components/clientes/ClienteInteraccionTimeline.vue → app/pages/login.vue
- `onConfirmarEliminar()` --calls--> `error`  [INFERRED]
  app/components/clientes/ClienteInteraccionTimeline.vue → app/pages/login.vue
- `onConfirmarEliminar()` --calls--> `error`  [INFERRED]
  app/components/clientes/VentaList.vue → app/pages/login.vue
- `onGuardarEdicion()` --calls--> `error`  [INFERRED]
  app/components/leads/LeadTimeline.vue → app/pages/login.vue
- `onConfirmarEliminar()` --calls--> `error`  [INFERRED]
  app/components/leads/LeadTimeline.vue → app/pages/login.vue

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Confirm-then-delete UI pattern reused across clientes/leads/tickets/productos** — sharedconfirmdialog_component, plan_eliminar_clientes, plan_eliminar_leads_tickets, plan_productos_catalogo [EXTRACTED 1.00]
- **Unified reminder/alert system spanning tasks and training appointments** — usetareas_composable, usecitascapacitacion_composable, recordatorioalert_component, recordatorioalertcontainer_component, plan_agenda_capacitaciones [EXTRACTED 1.00]
- **Permission resolution system: roles, per-user overrides, superadmin bypass** — has_permission_function, permisos_efectivos_usuario_function, profile_roles_table, user_permission_overrides_system [EXTRACTED 1.00]
- **pg_cron vencimiento-notification functions (tareas, citas, tickets_post_venta)** — concept_fn_notificar_tareas_vencidas, concept_fn_notificar_citas_vencidas, concept_broadcast_notification_pattern [INFERRED 0.85]
- **Components implementing the inline-edit-in-list UI pattern** — app_components_shared_tarealist, app_components_clientes_clienteinteracciontimeline, app_components_leads_leadtimeline, app_components_clientes_ventalist [INFERRED 0.85]
- **Phased responsive redesign (Fase 1 Shell, Fase 3 Kanban) sharing app/layouts/default.vue** — docs_superpowers_plans_2026_07_16_responsive_shell, docs_superpowers_plans_2026_07_16_responsive_kanban, app_layouts_default [EXTRACTED 1.00]
- **Rediseño responsive por fases (Shell → SplitView Clientes → Kanban)** — docs_superpowers_specs_2026_07_16_responsive_shell_design_doc, docs_superpowers_specs_2026_07_16_responsive_clientes_splitview_design_doc, docs_superpowers_specs_2026_07_16_responsive_kanban_design_doc [INFERRED 0.85]
- **Patrón compartido de cron horario que notifica vencidos/archiva** — docs_superpowers_specs_2026_07_13_recordatorio_alert_design_notificacion_tarea_vencida_cron, docs_superpowers_specs_2026_07_14_agenda_capacitaciones_design_fn_notificar_citas_vencidas, docs_superpowers_specs_2026_07_14_tickets_post_venta_design_fn_notificar_tickets_post_venta_vencidos, docs_superpowers_specs_2026_07_15_historial_estados_archivado_design_fn_archivar_cerrados [INFERRED 0.85]
- **Dos familias de patrón RLS: propiedad individual (owner_id) vs recurso/equipo compartido (sin owner_id)** — docs_superpowers_specs_2026_07_12_productos_catalogo_design_tabla_productos, docs_superpowers_specs_2026_07_14_tickets_post_venta_design_tabla_tickets_post_venta, docs_superpowers_specs_2026_07_13_ventas_cliente_design_tabla_ventas, docs_superpowers_specs_2026_07_14_agenda_capacitaciones_design_tabla_citas_capacitacion [INFERRED 0.75]

## Communities (129 total, 39 thin omitted)

### Community 0 - "Admin Permisos Page"
Cohesion: 0.06
Nodes (62): /admin/permisos page — UI to grant/revoke individual permission overrides, /admin/usuarios page — assign/remove multiple roles per user, Avatar.vue — image with initials fallback, calcularDiff() — pure function reducing audit before/after JSON to changed fields, CapacitacionesCitaForm.vue — training appointment create/edit form, citas_capacitacion table — training appointment agenda, owner_id + view_all RLS, citas_descartadas table — per-user dismissal of training-appointment reminders, ClienteBuscador.vue — debounced client search combobox (+54 more)

### Community 1 - "Components Tickets Ticketform"
Cohesion: 0.05
Nodes (35): emit, errores, esEditando, { fetchUsuariosPorRol }, form, onSubmit(), props, responsables (+27 more)

### Community 2 - "Components Post Venta"
Cohesion: 0.05
Nodes (30): columnas, emit, grupos, onDragChange(), props, tabActiva, columnas, emit (+22 more)

### Community 3 - "Components Post Venta"
Cohesion: 0.05
Nodes (35): cargando, cargar(), comentario, emit, fecha, { fetchSeguimientos, agregarSeguimiento }, guardando, onSubmit() (+27 more)

### Community 4 - "Pages Capacitaciones Index"
Cohesion: 0.05
Nodes (32): aEliminar, cambiarEstado(), { can }, cargando, cargar(), citaEditando, citas, citasFiltradas (+24 more)

### Community 5 - "Components Shared Configuracionmodal"
Cohesion: 0.06
Nodes (31): diasLeads, diasPostVenta, diasTickets, emit, { fetchConfiguracion, actualizarDias }, guardando, mostrarArchivado, onGuardar() (+23 more)

### Community 6 - "Pages Admin Auditoria"
Cohesion: 0.06
Nodes (32): AuditoriaEntry, AuditoriaFiltros, campoIdentificador, cargando, cargandoMas, cargarMas(), cargarPrimeraPagina(), colorAccion (+24 more)

### Community 7 - "Components Clientes Ventalist"
Cohesion: 0.07
Nodes (31): aEliminar, aFechaInput(), aHoraInput(), { can }, cargando, cargar(), construirFecha(), eliminando (+23 more)

### Community 8 - "Components Clientes Clientesplitview"
Cohesion: 0.07
Nodes (26): asignando, { asignarCliente, updateCliente, subirImagenCliente }, busqueda, { can }, clientesFiltrados, { fetchTicketsPorCliente }, { fetchUltimasInteracciones }, filtroAntiguedad (+18 more)

### Community 9 - "Components Shared Tarealist"
Cohesion: 0.08
Nodes (26): aEliminar, aFechaInput(), aHoraInput(), cargando, cargar(), construirFechaVencimiento(), eliminando, fechaEditada (+18 more)

### Community 10 - "Components Clientes Clienteinteracciontimeline"
Cohesion: 0.08
Nodes (24): aEliminar, archivoAdjunto, canal, canalEditado, cargando, cargar(), eliminando, emit (+16 more)

### Community 11 - "Components Leads Leadtimeline"
Cohesion: 0.07
Nodes (24): aEliminar, archivoAdjunto, canal, canalEditado, cargando, cargar(), eliminando, { fetchInteracciones, agregarInteraccion, actualizarInteraccion, eliminarInteraccion } (+16 more)

### Community 12 - "Components Clientes Clienteform"
Cohesion: 0.09
Nodes (20): archivoImagen, emit, errores, errorImagen, form, imagenQuitada, inputImagen, onSubmit() (+12 more)

### Community 13 - "Pages Productos Index"
Cohesion: 0.08
Nodes (21): busqueda, { can }, cargando, categorias, colorEstado, confirmandoEliminar, creando, eliminando (+13 more)

### Community 14 - "Pages Tickets Id"
Cohesion: 0.10
Nodes (19): asignando, { can }, cargando, confirmandoEliminar, eliminando, { fetchProductosDeTicket, agregarProductoATicket, quitarProductoDeTicket }, { fetchTecnicos }, { getTicket, updateTicket, deleteTicket, asignarTecnico } (+11 more)

### Community 15 - "Components Capacitaciones Calendariomes"
Cohesion: 0.11
Nodes (14): aniosDisponibles, CeldaCalendario, celdas, citasPorDia, DIAS_SEMANA, emit, hoy, keyHoy (+6 more)

### Community 16 - "Components Shared Galeriaimagenes"
Cohesion: 0.12
Nodes (17): aEliminar, anterior(), cargando, eliminando, { error }, { fetchImagenes, subirImagen, eliminarImagen }, imagenes, inputArchivo (+9 more)

### Community 17 - "Composables Usebusquedaglobal"
Cohesion: 0.15
Nodes (12): escaparIlike(), ResultadoBusqueda, useBusquedaGlobal(), Cliente, EstadoLead, Lead, EstadoTicket, PrioridadTicket (+4 more)

### Community 18 - "Pages Leads Index"
Cohesion: 0.11
Nodes (17): busqueda, { can }, cargando, { fetchLeads, cambiarEstado, importLeads, createLead }, { fetchUsuariosPorRol }, filtroVendedor, guardando, importando (+9 more)

### Community 19 - "Pages Clientes Index"
Cohesion: 0.11
Nodes (15): { can }, cargando, clienteAEliminar, clientes, creando, eliminando, { fetchClientes, importClientes, deleteCliente, createCliente, updateCliente, subirImagenCliente }, { fetchUsuariosPorRol } (+7 more)

### Community 20 - "Pages Panel Dev"
Cohesion: 0.11
Nodes (15): cargando, errores, features, featuresDelUsuario, { fetchErrores }, { fetchTodasLasFeatures, crearFeature, fetchFeaturesDeUsuario, otorgarFeature, quitarFeature }, { fetchUsuarios }, nuevaDescripcion (+7 more)

### Community 21 - "Components Shared Notificationbell"
Cohesion: 0.12
Nodes (10): abierto, cargando, contenedor, { error: toastError }, etiquetaTipo, { fetchNotificaciones, marcarLeida, marcarTodasLeidas, eliminarNotificacion, suscribirNotificaciones }, noLeidas, notificaciones (+2 more)

### Community 22 - "Components Shared Perfilmodal"
Cohesion: 0.12
Nodes (16): { cambiarPassword }, confirmarPassword, emit, errorPassword, guardando, guardandoPassword, inputArchivo, nombre (+8 more)

### Community 23 - "Pages Admin Permisos"
Cohesion: 0.12
Nodes (15): aplicarEstado(), cargando, cargandoUsuario, catalogo, estadoDe(), { fetchCatalogoPermisos, fetchHeredadosDeRoles, fetchOverridesDeUsuario, setOverride, quitarOverride }, { fetchUsuarios }, heredados (+7 more)

### Community 24 - "Pages Leads Id"
Cohesion: 0.12
Nodes (15): { can }, cargando, confirmandoEliminar, convirtiendo, eliminando, errorConversion, { getLead, updateLead, deleteLead, convertirACliente }, guardando (+7 more)

### Community 25 - "Pages Admin Usuarios"
Cohesion: 0.13
Nodes (14): alternarRol(), aplicando, cargando, catalogoRoles, { esSuperadmin }, { fetchCatalogoRoles, asignarRol, quitarRol }, { fetchUsuarios }, rolesDelUsuario (+6 more)

### Community 26 - "Pages Post Venta"
Cohesion: 0.12
Nodes (13): { can }, cargando, confirmandoEliminar, eliminando, estados, { getTicket, actualizarTicket, eliminarTicket }, guardando, onCambiarEstado() (+5 more)

### Community 27 - "Components Shared Recordatorioalertcontainer"
Cohesion: 0.16
Nodes (9): AvisoRecordatorio, esVencida, props, AvisoConTipo, avisos, {
  citasProximas,
  refrescarCitasProximas,
  descartarCitaProxima,
  cargarDescartadasGuardadas: cargarDescartesCitas,
}, router, rutaEntidad (+1 more)

### Community 28 - "Pages Post Venta"
Cohesion: 0.16
Nodes (13): busqueda, { can }, cargando, cargar(), { fetchTickets, crearTicket, actualizarTicket }, guardando, modalAbierto, onCambiarEstado() (+5 more)

### Community 29 - "Components Productos Productobuscador"
Cohesion: 0.19
Nodes (11): abierto, contenedor, elegir(), emit, etiqueta(), { fetchProductos }, productos, props (+3 more)

### Community 30 - "Components Widgets Chartfunnelleads"
Cohesion: 0.15
Nodes (10): cargando, colores, etapas, { fetchFunnel }, funnel, labelsEstado, ordenPipeline, perdidos (+2 more)

### Community 31 - "Eslint"
Cohesion: 0.15
Nodes (13): eslint, nuxt, @nuxtjs/supabase, dependencies, eslint, nuxt, @nuxtjs/supabase, pinia (+5 more)

### Community 32 - "Components Clientes Clientebuscador"
Cohesion: 0.20
Nodes (10): abierto, { buscarClientes, getCliente }, cargando, contenedor, elegir(), emit, props, resultados (+2 more)

### Community 33 - "Pages Tickets Nuevo"
Cohesion: 0.17
Nodes (11): { agregarProductoATicket }, cargando, clienteIdFijo, clienteNombreFijo, { createTicket }, { getCliente }, onSubmit(), route (+3 more)

### Community 34 - "Components Shared Globalsearch"
Cohesion: 0.18
Nodes (8): abierto, { buscar }, cargando, contenedor, hayResultados, resultados, router, termino

### Community 35 - "Pages Admin Dashboards"
Cohesion: 0.18
Nodes (9): cargando, catalogo, { fetchCatalogo, fetchWidgetsDeUsuario, asignarWidget, quitarWidget }, { fetchUsuarios }, { success, error }, toggleWidget(), usuarios, usuarioSeleccionado (+1 more)

### Community 36 - "Pages Productos Index"
Cohesion: 0.18
Nodes (11): onArchivoSeleccionado(), onConfirmarEliminar(), onSubmitNuevo(), onConfirmarEliminar(), onConvertir(), onSubmit(), error, onArchivoSeleccionado() (+3 more)

### Community 37 - "Pages Login"
Cohesion: 0.18
Nodes (9): cargando, email, mostrarPassword, password, recordar, route, router, supabase (+1 more)

### Community 38 - "Docs Superpowers Specs 2026"
Cohesion: 0.24
Nodes (11): Alert de tarea próxima a vencer — design spec, Cron notificacion_tarea_vencida (preexistente, horario), RecordatorioAlert.vue component, RecordatorioAlertContainer.vue component, ConfiguracionModal.vue component, Menú de usuario, perfil editable y configuración — design spec, PerfilModal.vue component, SharedModal.vue component (modal base genérico) (+3 more)

### Community 39 - "Components Shared Usermenu"
Cohesion: 0.20
Nodes (6): abierto, configuracionAbierta, contenedor, { logout }, { perfil }, perfilAbierto

### Community 40 - "Components Widgets Kpitasaconversion"
Cohesion: 0.22
Nodes (9): cargando, { fetchFunnel }, tasa, user_permission_overrides(user_id, permission_id, effect) per-user RBAC exception mechanism, Plan: Permiso ventas.view_all Natalia + filtro vendedor Leads, Spec: Overrides de permisos por usuario + widgets acoplados a permisos, Spec: Convertir Reportes en widgets del dashboard, Spec: Filtro por vendedor en la vista de Clientes (+1 more)

### Community 41 - "Docs Superpowers Specs 2026"
Cohesion: 0.25
Nodes (9): ClienteBuscador.vue component (autocompletar cliente), Buscador de cliente en formulario de Ticket — design spec, Agenda de capacitaciones — design spec, fn_notificar_citas_vencidas() — cron horario, Tabla citas_capacitacion (owner_id, un cliente por cita), Tabla citas_descartadas (descarte persistido server-side), useCitasCapacitacion composable, CapacitacionesCalendarioMes.vue component (+1 more)

### Community 42 - "Docs Superpowers Specs 2026"
Cohesion: 0.31
Nodes (9): Pestaña Ventas en detalle de cliente — design spec, Tabla ventas (owner_id, patrón tickets), useVentas composable, VentaList.vue component, Permiso ventas.view_all para Natalia + filtro de vendedor en Leads — design spec, Override individual ventas.view_all (Natalia Quevedo), Editar/eliminar ventas + productos comprados en tickets — design spec, Tabla ticket_productos (relación tickets↔productos, multi-select) (+1 more)

### Community 43 - "Components Productos Productoform"
Cohesion: 0.32
Nodes (7): activo, emit, errores, form, onSubmit(), props, validar()

### Community 44 - "Components Widgets Chartperformancevendedores"
Cohesion: 0.25
Nodes (6): { can }, cargando, categorias, { fetchPerformance }, performance, performanceData

### Community 46 - "Docs Superpowers Specs 2026"
Cohesion: 0.29
Nodes (8): Catálogo de Productos — design spec, Tabla productos (catálogo compartido, sin owner_id), useProductos composable, Tickets de Post-venta — design spec, fn_notificar_tickets_post_venta_vencidos() — cron horario, destinatario = rol completo, Tabla tickets_post_venta (sin owner_id, equipo compartido), Tabla tickets_post_venta_seguimientos (bitácora insert-only), useTicketsPostVenta composable

### Community 47 - "Components Leads Leadform"
Cohesion: 0.38
Nodes (6): emit, errores, form, onSubmit(), props, validar()

### Community 48 - "Pages Index"
Cohesion: 0.29
Nodes (6): cargando, chartsVisibles, componentMap, kpisVisibles, { misWidgets, cargarMisWidgets }, widgetsVisibles

### Community 49 - "Pages Leads Historial"
Cohesion: 0.29
Nodes (5): cargando, { fetchHistorial }, { fetchLeadsPorIds }, FilaHistorial, filas

### Community 50 - "Pages Post Venta"
Cohesion: 0.29
Nodes (5): cargando, { fetchHistorial }, { fetchTicketsPorIds }, FilaHistorial, filas

### Community 51 - "Pages Tickets Historial"
Cohesion: 0.29
Nodes (5): cargando, { fetchHistorial }, { fetchTicketsPorIds }, FilaHistorial, filas

### Community 52 - "Docs Superpowers Specs 2026"
Cohesion: 0.33
Nodes (7): Responsive Fase 2 (parcial): Clientes ClienteSplitView — design spec, Patrón una-vista-a-la-vez + volver (mobile ClienteSplitView), Responsive Fase 3: Kanban de leads/tickets/post-venta — design spec, Patrón tabs + select "Mover a" (mobile Kanban), Principio YAGNI: no abstraer componentes ya duplicados a propósito, Responsive Fase 1: Shell (sidebar + topbar) — design spec, Patrón drawer superpuesto (mobile sidebar)

### Community 53 - "Components Shared Textoexpandible"
Cohesion: 0.33
Nodes (4): clampeado, el, expandido, props

### Community 54 - "Package"
Cohesion: 0.33
Nodes (5): name, overrides, ajv, private, type

### Community 55 - "Package Scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, generate, postinstall, preview

### Community 56 - "Composables Usemiperfil"
Cohesion: 0.50
Nodes (4): FilaPerfil, mapearPerfil(), MiPerfil, useMiPerfil()

### Community 57 - "Composables Useusuarios"
Cohesion: 0.50
Nodes (4): FilaUsuario, mapearUsuario(), useUsuarios(), Usuario

### Community 58 - "Pages Leads Cerrados"
Cohesion: 0.40
Nodes (3): cargando, { fetchCerrados }, leads

### Community 59 - "Pages Post Venta"
Cohesion: 0.40
Nodes (3): cargando, { fetchCerrados }, tickets

### Community 60 - "Pages Tickets Cerrados"
Cohesion: 0.40
Nodes (3): cargando, { fetchCerrados }, tickets

### Community 61 - "Docs Superpowers Specs 2026"
Cohesion: 0.40
Nodes (5): Principio: "borrar" = archivar, no eliminar (nunca se pierde dato), Historial de estados y archivado automático — design spec, fn_archivar_cerrados() — cron diario de archivado, Tabla configuracion_archivado (días por módulo, valor global), Tabla historial_estados (genérica entidad_tipo/entidad_id)

### Community 62 - "Iconify Json Mdi"
Cohesion: 0.40
Nodes (5): @iconify-json/mdi, devDependencies, @iconify-json/mdi, @types/papaparse, @types/papaparse

### Community 63 - "Components Shared Toastcontainer"
Cohesion: 0.50
Nodes (3): estilos, iconos, { toasts, quitar }

### Community 64 - "Components Widgets Kpiclientestotales"
Cohesion: 0.50
Nodes (3): cantidad, cargando, { fetchClientes }

### Community 65 - "Components Widgets Kpileadsactivos"
Cohesion: 0.50
Nodes (3): cantidad, cargando, { fetchLeads }

### Community 66 - "Components Widgets Kpileadsganados"
Cohesion: 0.50
Nodes (3): cantidad, cargando, { fetchFunnel }

### Community 67 - "Components Widgets Kpileadsperdidos"
Cohesion: 0.50
Nodes (3): cantidad, cargando, { fetchFunnel }

### Community 68 - "Components Widgets Kpiticketsabiertos"
Cohesion: 0.50
Nodes (3): cantidad, cargando, { fetchTickets }

### Community 69 - "Components Widgets Kpitotalleads"
Cohesion: 0.50
Nodes (3): cantidad, cargando, { fetchFunnel }

### Community 79 - "Docs Superpowers Specs 2026"
Cohesion: 0.50
Nodes (4): Multi-rol de usuarios — design spec, has_permission() / permisos_efectivos_usuario() — resolución por unión de roles, Tabla profile_roles (many-to-many usuario↔rol), useRolesUsuario composable

### Community 80 - "Docs Superpowers Specs 2026"
Cohesion: 0.50
Nodes (4): Gotcha #11: sentinel de hora al combinar fecha+hora (default 23:59), Editar interacciones y tareas/recordatorios — design spec, Patrón de edición inline (un solo idEditando por componente), Gotcha #18: RLS bloquea delete/update en silencio, hay que chequear filas afectadas

### Community 82 - "Components Clientes Clientesplitview"
Cohesion: 0.67
Nodes (3): emit, onAsignarVendedor(), onSubmitEdicion()

## Knowledge Gaps
- **688 isolated node(s):** `props`, `DIAS_SEMANA`, `MESES`, `hoy`, `mesCursor` (+683 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `error` connect `Pages Productos Index` to `Components Post Venta`, `Pages Capacitaciones Index`, `Components Shared Configuracionmodal`, `Components Clientes Ventalist`, `Components Shared Tarealist`, `Components Clientes Clienteinteracciontimeline`, `Components Leads Leadtimeline`, `Pages Tickets Id`, `Components Shared Galeriaimagenes`, `Pages Leads Index`, `Pages Panel Dev`, `Components Shared Perfilmodal`, `Pages Admin Permisos`, `Pages Admin Usuarios`, `Pages Post Venta`, `Pages Post Venta`, `Pages Tickets Nuevo`, `Pages Admin Dashboards`, `Pages Login`, `Components Clientes Clientesplitview`?**
  _High betweenness centrality (0.257) - this node is a cross-community bridge._
- **Why does `onSubmit()` connect `Components Post Venta` to `Pages Productos Index`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `Plan: Tickets de Post-venta` connect `Components Post Venta` to `Components Post Venta`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Are the 52 inferred relationships involving `error` (e.g. with `onConfirmarEliminar()` and `onGuardarEdicion()`) actually correct?**
  _`error` has 52 INFERRED edges - model-reasoned connections that need verification._
- **What connects `props`, `DIAS_SEMANA`, `MESES` to the rest of the system?**
  _688 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Permisos Page` be split into smaller, more focused modules?**
  _Cohesion score 0.05764145954521417 - nodes in this community are weakly interconnected._
- **Should `Components Tickets Ticketform` be split into smaller, more focused modules?**
  _Cohesion score 0.04830917874396135 - nodes in this community are weakly interconnected._