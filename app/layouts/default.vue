<script setup lang="ts">
// Layout general de toda la app (excepto /login, que usa layout: false).
// Estructura: sidebar fija a la izquierda + topbar arriba + contenido.

const route = useRoute()
const { can } = usePermissions()
const { esSuperadmin } = useSuperadmin()
const { perfil, cargarMiPerfil } = useMiPerfil()
const { logout } = useAuth()

onMounted(async () => {
  if (!perfil.value) await cargarMiPerfil()
})

const esActivo = (path: string) => route.path === path || route.path.startsWith(path + '/')

const navCrm = [
  { path: '/clientes', label: 'Clientes', permiso: ['view', 'view_all'] as const, resource: 'clientes' },
  { path: '/leads', label: 'Leads', permiso: ['view', 'view_all'] as const, resource: 'leads' },
  { path: '/tickets', label: 'Tickets', permiso: ['view', 'view_all'] as const, resource: 'tickets' },
  { path: '/reportes', label: 'Reportes', permiso: ['view', 'view_all'] as const, resource: 'reportes' },
]
</script>

<template>
  <div class="min-h-screen bg-[#F5F7FA] flex">
    <!-- Sidebar -->
    <aside class="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div class="h-16 flex items-center px-5 border-b border-gray-200">
        <SharedAppLogo />
      </div>

      <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        <div>
          <NuxtLink
            to="/"
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="esActivo('/') && route.path === '/'
              ? 'bg-[#EAF4FA] text-[#0C5D91]'
              : 'text-gray-600 hover:bg-gray-50'"
          >
            Dashboard
          </NuxtLink>
        </div>

        <div>
          <p class="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">CRM</p>
          <div class="space-y-0.5">
            <NuxtLink
              v-for="item in navCrm"
              v-show="can(item.resource, item.permiso[0]) || can(item.resource, item.permiso[1])"
              :key="item.path"
              :to="item.path"
              class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              :class="esActivo(item.path)
                ? 'bg-[#EAF4FA] text-[#0C5D91]'
                : 'text-gray-600 hover:bg-gray-50'"
            >
              {{ item.label }}
            </NuxtLink>
          </div>
        </div>

        <div v-if="can('dashboard_widgets', 'assign') || can('auditoria', 'view_all')">
          <p class="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Administración</p>
          <NuxtLink
            v-if="can('dashboard_widgets', 'assign')"
            to="/admin/dashboards"
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="esActivo('/admin/dashboards')
              ? 'bg-[#EAF4FA] text-[#0C5D91]'
              : 'text-gray-600 hover:bg-gray-50'"
          >
            Dashboards
          </NuxtLink>
          <NuxtLink
            v-if="can('auditoria', 'view_all')"
            to="/admin/auditoria"
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="esActivo('/admin/auditoria')
              ? 'bg-[#EAF4FA] text-[#0C5D91]'
              : 'text-gray-600 hover:bg-gray-50'"
          >
            Auditoría
          </NuxtLink>
        </div>

        <div v-if="esSuperadmin">
          <p class="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Sistema</p>
          <NuxtLink
            to="/panel-dev"
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="esActivo('/panel-dev')
              ? 'bg-[#EAF4FA] text-[#0C5D91]'
              : 'text-gray-600 hover:bg-gray-50'"
          >
            Panel dev
          </NuxtLink>
        </div>
      </nav>
    </aside>

    <!-- Contenido -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Topbar -->
      <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
        <div class="flex-1 max-w-md">
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Buscar..."
              class="w-full bg-gray-50 border border-gray-200 rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
            />
          </div>
        </div>

        <div class="flex items-center gap-3">
          <SharedAvatar v-if="perfil?.full_name || perfil?.email" :nombre="perfil.full_name || perfil.email || '?'" />
          <div class="text-right hidden sm:block">
            <p class="text-sm font-medium text-gray-700 leading-tight">
              {{ perfil?.full_name || perfil?.email || '...' }}
            </p>
            <p class="text-xs text-gray-400 leading-tight capitalize">{{ perfil?.role || '' }}</p>
          </div>
          <button
            title="Cerrar sesión"
            class="text-gray-400 hover:text-red-500 text-sm px-2 py-1 rounded transition-colors"
            @click="logout"
          >
            Salir
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto">
        <slot />
      </main>
    </div>

    <SharedToastContainer />
  </div>
</template>