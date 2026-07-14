<script setup lang="ts">
// Layout general de toda la app (excepto /login, que usa layout: false).
// Estructura: sidebar fija a la izquierda + topbar arriba + contenido.

const route = useRoute()
const { can } = usePermissions()
const { esSuperadmin } = useSuperadmin()
const { perfil, cargarMiPerfil } = useMiPerfil()

onMounted(async () => {
  if (!perfil.value) await cargarMiPerfil()
})

const esActivo = (path: string) => route.path === path || route.path.startsWith(path + '/')

const navCrm = [
  { path: '/clientes', label: 'Clientes', permiso: ['view', 'view_all'] as const, resource: 'clientes' },
  { path: '/leads', label: 'Leads', permiso: ['view', 'view_all'] as const, resource: 'leads' },
  { path: '/tickets', label: 'Tickets', permiso: ['view', 'view_all'] as const, resource: 'tickets' },
  { path: '/productos', label: 'Productos', permiso: ['view', 'view_all'] as const, resource: 'productos' },
]
</script>

<template>
  <div class="min-h-screen bg-bg flex">
    <!-- Sidebar -->
    <aside class="w-64 bg-surface border-r border-border flex flex-col shrink-0">
      <div class="h-16 flex items-center px-5 border-b border-border">
        <SharedAppLogo />
      </div>

      <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        <div>
          <SharedNavLink to="/" :activo="esActivo('/') && route.path === '/'">
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
              :activo="esActivo(item.path)"
            >
              {{ item.label }}
            </SharedNavLink>
          </div>
        </div>

        <div v-if="can('dashboard_widgets', 'assign') || can('auditoria', 'view_all')">
          <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Administración</p>
          <div class="space-y-0.5">
            <SharedNavLink v-if="can('dashboard_widgets', 'assign')" to="/admin/dashboards" :activo="esActivo('/admin/dashboards')">
              Dashboards
            </SharedNavLink>
            <SharedNavLink v-if="can('dashboard_widgets', 'assign')" to="/admin/permisos" :activo="esActivo('/admin/permisos')">
              Permisos
            </SharedNavLink>
            <SharedNavLink v-if="can('dashboard_widgets', 'assign')" to="/admin/usuarios" :activo="esActivo('/admin/usuarios')">
              Usuarios
            </SharedNavLink>
            <SharedNavLink v-if="can('auditoria', 'view_all')" to="/admin/auditoria" :activo="esActivo('/admin/auditoria')">
              Auditoría
            </SharedNavLink>
          </div>
        </div>

        <div v-if="esSuperadmin">
          <p class="px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Sistema</p>
          <div class="space-y-0.5">
            <SharedNavLink to="/panel-dev" :activo="esActivo('/panel-dev')">
              Panel dev
            </SharedNavLink>
          </div>
        </div>
      </nav>
    </aside>

    <!-- Contenido -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Topbar -->
      <header class="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
        <div class="flex-1 max-w-md">
          <SharedGlobalSearch />
        </div>

        <div class="flex items-center gap-3">
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