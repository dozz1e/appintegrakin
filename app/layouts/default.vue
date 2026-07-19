<script setup lang="ts">
// Layout general de toda la app (excepto /login, que usa layout: false).
// Estructura: sidebar fija a la izquierda + topbar arriba + contenido.

const route = useRoute()
const { can } = usePermissions()
const { esSuperadmin } = useSuperadmin()
const { perfil, cargarMiPerfil } = useMiPerfil()

const mobileMenuAbierto = ref(false)
const configAbierta = ref(false)

// Colapso de sidebar es solo de escritorio (el botón que lo activa está
// oculto en mobile) - persiste en localStorage para que no vuelva a
// expandirse cada vez que se recarga la página.
const sidebarColapsado = ref(false)
const sidebarMostrandoColapsado = computed(() => sidebarColapsado.value && !mobileMenuAbierto.value)

function alternarSidebar() {
  sidebarColapsado.value = !sidebarColapsado.value
  localStorage.setItem('sidebar-colapsado', String(sidebarColapsado.value))
}

watch(() => route.path, () => {
  mobileMenuAbierto.value = false
})

onMounted(async () => {
  if (!perfil.value) await cargarMiPerfil()
  sidebarColapsado.value = localStorage.getItem('sidebar-colapsado') === 'true'
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
      class="fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-border lg:bg-transparent lg:border-r-0 flex flex-col transition-[transform,width] duration-200 lg:static lg:translate-x-0 lg:shrink-0"
      :class="[
        mobileMenuAbierto ? 'translate-x-0' : '-translate-x-full',
        sidebarColapsado ? 'lg:w-[4.5rem]' : 'lg:w-64',
      ]"
    >
      <div class="h-16 flex items-center border-b border-border lg:border-transparent" :class="sidebarMostrandoColapsado ? 'justify-center px-2' : 'justify-between px-5'">
        <SharedAppLogo v-if="!sidebarMostrandoColapsado" />
        <button
          type="button"
          class="hidden lg:flex w-9 h-9 items-center justify-center rounded-full border-2 border-primary bg-primary-subtle text-primary shadow-sm hover:bg-primary hover:text-ink-onprimary transition-colors duration-150 shrink-0"
          :title="sidebarColapsado ? 'Expandir menú' : 'Colapsar menú'"
          @click="alternarSidebar"
        >
          <Icon :name="sidebarColapsado ? 'mdi:chevron-double-right' : 'mdi:chevron-double-left'" class="w-5 h-5" />
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto py-4 space-y-6" :class="sidebarMostrandoColapsado ? 'px-2' : 'px-3'">
        <div>
          <SharedNavLink to="/" icono="mdi:view-dashboard-outline" :activo="esActivo('/') && route.path === '/'" :colapsado="sidebarMostrandoColapsado">
            Dashboard
          </SharedNavLink>
        </div>

        <div>
          <p v-if="!sidebarMostrandoColapsado" class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">CRM</p>
          <div class="space-y-0.5">
            <template v-for="item in navCrm" :key="item.path">
              <SharedNavLink
                v-if="can(item.resource, item.permiso[0]) || can(item.resource, item.permiso[1])"
                :to="item.path"
                :icono="item.icono"
                :activo="esActivo(item.path)"
                :colapsado="sidebarMostrandoColapsado"
              >
                {{ item.label }}
              </SharedNavLink>
            </template>
          </div>
        </div>

        <div v-if="can('leads', 'view') || can('leads', 'view_all')">
          <p v-if="!sidebarMostrandoColapsado" class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Leads</p>
          <div class="space-y-0.5">
            <SharedNavLink to="/leads" icono="mdi:account-arrow-right-outline" :activo="esActivoListado('/leads')" :colapsado="sidebarMostrandoColapsado">Leads</SharedNavLink>
            <SharedNavLink to="/leads/historial-movimientos" icono="mdi:history" :activo="esActivo('/leads/historial-movimientos')" :colapsado="sidebarMostrandoColapsado">
              Historial de leads
            </SharedNavLink>
            <SharedNavLink to="/leads/cerrados" icono="mdi:archive-outline" :activo="esActivo('/leads/cerrados')" :colapsado="sidebarMostrandoColapsado">Leads cerrados</SharedNavLink>
          </div>
        </div>

        <div v-if="can('tickets', 'view') || can('tickets', 'view_all')">
          <p v-if="!sidebarMostrandoColapsado" class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Servicio Técnico</p>
          <div class="space-y-0.5">
            <SharedNavLink to="/tickets" icono="mdi:wrench-outline" :activo="esActivoListado('/tickets')" :colapsado="sidebarMostrandoColapsado">Servicio Técnico</SharedNavLink>
            <SharedNavLink to="/tickets/historial-movimientos" icono="mdi:history" :activo="esActivo('/tickets/historial-movimientos')" :colapsado="sidebarMostrandoColapsado">
              Historial de servicio técnico
            </SharedNavLink>
            <SharedNavLink to="/tickets/cerrados" icono="mdi:archive-outline" :activo="esActivo('/tickets/cerrados')" :colapsado="sidebarMostrandoColapsado">Cerrados Servicio Técnico</SharedNavLink>
          </div>
        </div>

        <div v-if="can('tickets_post_venta', 'view')">
          <p v-if="!sidebarMostrandoColapsado" class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Post Venta</p>
          <div class="space-y-0.5">
            <SharedNavLink to="/post-venta" icono="mdi:truck-delivery-outline" :activo="esActivoListado('/post-venta')" :colapsado="sidebarMostrandoColapsado">Post Venta</SharedNavLink>
            <SharedNavLink to="/post-venta/historial-movimientos" icono="mdi:history" :activo="esActivo('/post-venta/historial-movimientos')" :colapsado="sidebarMostrandoColapsado">
              Historial post venta
            </SharedNavLink>
            <SharedNavLink to="/post-venta/cerrados" icono="mdi:archive-outline" :activo="esActivo('/post-venta/cerrados')" :colapsado="sidebarMostrandoColapsado">Cerrados Post Venta</SharedNavLink>
          </div>
        </div>

        <div v-if="can('capacitaciones', 'view') || can('capacitaciones', 'view_all')">
          <p v-if="!sidebarMostrandoColapsado" class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Capacitaciones</p>
          <SharedNavLink to="/capacitaciones" icono="mdi:school-outline" :activo="esActivo('/capacitaciones')" :colapsado="sidebarMostrandoColapsado">
            Agenda
          </SharedNavLink>
        </div>

        <div v-if="can('dashboard_widgets', 'assign') || can('auditoria', 'view_all')">
          <p v-if="!sidebarMostrandoColapsado" class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Administración</p>
          <div class="space-y-0.5">
            <SharedNavLink v-if="can('dashboard_widgets', 'assign')" to="/admin/dashboards" icono="mdi:view-dashboard-edit-outline" :activo="esActivo('/admin/dashboards')" :colapsado="sidebarMostrandoColapsado">
              Dashboards
            </SharedNavLink>
            <SharedNavLink v-if="can('dashboard_widgets', 'assign')" to="/admin/permisos" icono="mdi:shield-lock-outline" :activo="esActivo('/admin/permisos')" :colapsado="sidebarMostrandoColapsado">
              Permisos
            </SharedNavLink>
            <SharedNavLink v-if="can('dashboard_widgets', 'assign')" to="/admin/usuarios" icono="mdi:account-cog-outline" :activo="esActivo('/admin/usuarios')" :colapsado="sidebarMostrandoColapsado">
              Usuarios
            </SharedNavLink>
            <SharedNavLink v-if="can('auditoria', 'view_all')" to="/admin/auditoria" icono="mdi:file-search-outline" :activo="esActivo('/admin/auditoria')" :colapsado="sidebarMostrandoColapsado">
              Auditoría
            </SharedNavLink>
          </div>
        </div>

        <div v-if="esSuperadmin">
          <p v-if="!sidebarMostrandoColapsado" class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Sistema</p>
          <div class="space-y-0.5">
            <SharedNavLink to="/panel-dev" icono="mdi:tools" :activo="esActivo('/panel-dev')" :colapsado="sidebarMostrandoColapsado">
              Panel dev
            </SharedNavLink>
          </div>
        </div>
      </nav>
    </aside>

    <!-- Contenido -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Topbar: transparente, se funde con el fondo gris de la página -->
      <header class="h-16 flex items-center gap-3 px-4 sm:px-6 shrink-0">
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

        <div class="flex items-center gap-4 shrink-0 ml-auto">
          <SharedNotificationBell />
          <div class="w-px h-6 bg-border" />
          <div class="flex items-center gap-2">
            <SharedUserMenu />
            <button
              type="button"
              class="w-9 h-9 flex items-center justify-center rounded-full text-ink-secondary hover:bg-surface-2 hover:text-ink transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
              title="Configuración"
              @click="configAbierta = true"
            >
              <Icon name="mdi:cog-outline" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto">
        <slot />
      </main>
    </div>

    <SharedToastContainer />
    <SharedRecordatorioAlertContainer />
    <SharedConfiguracionModal :open="configAbierta" @cerrar="configAbierta = false" />
  </div>
</template>