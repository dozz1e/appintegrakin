// middleware/auth.global.ts
// Corre en TODAS las rutas. Si no hay sesión, redirige a /login.
// Requiere supabase.redirect: false en nuxt.config.ts para no pelear
// con el redirect automático del módulo @nuxtjs/supabase.

const RUTAS_PUBLICAS = ['/login', '/auth/confirm']

export default defineNuxtRouteMiddleware(async (to) => {
  if (RUTAS_PUBLICAS.includes(to.path)) return

  const user = useSupabaseUser()
  if (!user.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  // Si la sesión se restauró por cookie (refresh, URL directa, pestaña nueva),
  // login.vue nunca corrió - hay que cargar el estado de la app acá también.
  // Cada composable guarda su propio flag "cargado", así que esto no repite
  // trabajo en cada navegación, solo la primera vez que hace falta.
  const { cargado: permisosCargados, cargarPermisos } = usePermissions()
  const { verificado, verificar } = useSuperadmin()
  const { cargado: featuresCargadas, cargarMisFeatures } = useFeatures()
  const { cargado: widgetsCargados, cargarMisWidgets } = useDashboardWidgets()
  const { perfil, cargarMiPerfil } = useMiPerfil()

  if (!permisosCargados.value) await cargarPermisos()
  if (!verificado.value) await verificar()
  if (!featuresCargadas.value) await cargarMisFeatures()
  if (!widgetsCargados.value) await cargarMisWidgets()
  if (!perfil.value) await cargarMiPerfil()
})
