<script setup lang="ts">
// Layout general de toda la app (excepto /login, que usa layout: false).
// Estructura: sidebar fija a la izquierda + topbar arriba + contenido.

const route = useRoute()
const { can } = usePermissions()
const { esSuperadmin } = useSuperadmin()
const { perfil, cargarMiPerfil } = useMiPerfil()

const mobileMenuAbierto = ref(false)

watch(() => route.path, () => {
  mobileMenuAbierto.value = false
})

onMounted(async () => {
  if (!perfil.value) await cargarMiPerfil()
})

const esActivo = (path: string) => route.path === path || route.path.startsWith(path + '/')

// para los links "Listado" de Leads/Tickets/Post Venta: igual que esActivo
// (para que /leads/[id] siga marcando "Listado" como activo), pero
// excluyendo explícitamente las rutas hermanas de historial/cerrados que
// también empiezan con el mismo prefijo.
const esActivoListado = (path: string) =>
  route.path === path ||
  (route.path.startsWith(path + '/') &&
    !route.path.startsWith(`${path}/historial-movimientos`) &&
    !route.path.startsWith(`${path}/cerrados`))

const navCrm = [
  { path: '/clientes', label: 'Clientes', permiso: ['view', 'view_all'] as const, resource: 'clientes', icono: 'mdi:account-group-outline' },
  { path: '/productos', label: 'Productos', permiso: ['view', 'view_all'] as const, resource: 'productos', icono: 'mdi:package-variant-closed' },
]
</script>

<template>
  <div class="min-h-screen bg-bg flex">
    <!-- Sidebar -->
    <div
      v-if="mobileMenuAbierto"
      class="fixed inset-0 bg-black/50 z-30 lg:hidden"
      @click="mobileMenuAbierto = false"
    />
    <aside
      class="fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-border flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 lg:shrink-0"
      :class="mobileMenuAbierto ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="h-16 flex items-center px-5 border-b border-border">
        <SharedAppLogo />
      </div>

      <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        <div>
          <SharedNavLink to="/" icono="mdi:view-dashboard-outline" :activo="esActivo('/') && route.path === '/'">
            Dashboard
          </SharedNavLink>
        </div>

        <div>
          <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">CRM</p>
          <div class="space-y-0.5">
            <SharedNavLink
              v-for="item in navCrm"
              v-show="can(item.resource, item.permiso[0]) || can(item.resource, item.permiso[1])"
              :key="item.path"
              :to="item.path"
              :icono="item.icono"
              :activo="esActivo(item.path)"
            >
              {{ item.label }}
            </SharedNavLink>
          </div>
        </div>

        <div v-if="can('leads', 'view') || can('leads', 'view_all')">
          <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Leads</p>
          <div class="space-y-0.5">
            <SharedNavLink to="/leads" icono="mdi:account-arrow-right-outline" :activo="esActivoListado('/leads')">Listado</SharedNavLink>
            <SharedNavLink to="/leads/historial-movimientos" icono="mdi:history" :activo="esActivo('/leads/historial-movimientos')">
              Historial de movimientos
            </SharedNavLink>
            <SharedNavLink to="/leads/cerrados" icono="mdi:archive-outline" :activo="esActivo('/leads/cerrados')">Historial de cerrados</SharedNavLink>
          </div>
        </div>

        <div v-if="can('tickets', 'view') || can('tickets', 'view_all')">
          <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Servicio Técnico</p>
          <div class="space-y-0.5">
            <SharedNavLink to="/tickets" icono="mdi:wrench-outline" :activo="esActivoListado('/tickets')">Tickets</SharedNavLink>
            <SharedNavLink to="/tickets/historial-movimientos" icono="mdi:history" :activo="esActivo('/tickets/historial-movimientos')">
              Historial de movimientos
            </SharedNavLink>
            <SharedNavLink to="/tickets/cerrados" icono="mdi:archive-outline" :activo="esActivo('/tickets/cerrados')">Historial de cerrados</SharedNavLink>
          </div>
        </div>

        <div v-if="can('tickets_post_venta', 'view')">
          <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Post Venta</p>
          <div class="space-y-0.5">
            <SharedNavLink to="/post-venta" icono="mdi:truck-delivery-outline" :activo="esActivoListado('/post-venta')">Tickets</SharedNavLink>
            <SharedNavLink to="/post-venta/historial-movimientos" icono="mdi:history" :activo="esActivo('/post-venta/historial-movimientos')">
              Historial de movimientos
            </SharedNavLink>
            <SharedNavLink to="/post-venta/cerrados" icono="mdi:archive-outline" :activo="esActivo('/post-venta/cerrados')">Historial de cerrados</SharedNavLink>
          </div>
        </div>

        <div v-if="can('capacitaciones', 'view') || can('capacitaciones', 'view_all')">
          <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Capacitaciones</p>
          <SharedNavLink to="/capacitaciones" icono="mdi:school-outline" :activo="esActivo('/capacitaciones')">
            Agenda
          </SharedNavLink>
        </div>

        <div v-if="can('dashboard_widgets', 'assign') || can('auditoria', 'view_all')">
          <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Administración</p>
          <div class="space-y-0.5">
            <SharedNavLink v-if="can('dashboard_widgets', 'assign')" to="/admin/dashboards" icono="mdi:view-dashboard-edit-outline" :activo="esActivo('/admin/dashboards')">
              Dashboards
            </SharedNavLink>
            <SharedNavLink v-if="can('dashboard_widgets', 'assign')" to="/admin/permisos" icono="mdi:shield-lock-outline" :activo="esActivo('/admin/permisos')">
              Permisos
            </SharedNavLink>
            <SharedNavLink v-if="can('dashboard_widgets', 'assign')" to="/admin/usuarios" icono="mdi:account-cog-outline" :activo="esActivo('/admin/usuarios')">
              Usuarios
            </SharedNavLink>
            <SharedNavLink v-if="can('auditoria', 'view_all')" to="/admin/auditoria" icono="mdi:file-search-outline" :activo="esActivo('/admin/auditoria')">
              Auditoría
            </SharedNavLink>
          </div>
        </div>

        <div v-if="esSuperadmin">
          <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Sistema</p>
          <div class="space-y-0.5">
            <SharedNavLink to="/panel-dev" icono="mdi:tools" :activo="esActivo('/panel-dev')">
              Panel dev
            </SharedNavLink>
          </div>
        </div>
      </nav>
    </aside>

    <!-- Contenido -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Topbar -->
      <header class="h-16 bg-surface border-b border-border flex items-center gap-3 px-4 sm:px-6 shrink-0">
        <button
          type="button"
          class="lg:hidden text-ink-secondary hover:text-ink p-2 -ml-2"
          @click="mobileMenuAbierto = true"
        >
          <Icon name="mdi:menu" class="w-6 h-6" />
        </button>

        <div class="flex-1 min-w-0 max-w-md">
          <SharedGlobalSearch />
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <SharedNotificationBell />
          <SharedUserMenu />
        </div>
      </header>

      <main class="flex-1 overflow-y-auto">
        <slot />
      </main>
    </div>

    <SharedToastContainer />
    <SharedRecordatorioAlertContainer />
  </div>
</template>