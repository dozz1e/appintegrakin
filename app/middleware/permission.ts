// middleware/permission.ts
// Middleware nombrado (no global) - se activa por página con definePageMeta:
//
//   definePageMeta({
//     middleware: 'permission',
//     permiso: { resource: 'leads', actions: ['view', 'view_all'] } // OR: basta con uno
//   })
//
// Corre DESPUÉS de auth.global.ts (los middleware globales siempre van antes
// que los de página), así que para cuando esto ejecuta ya sabemos que hay sesión.

export interface PermisoRequerido {
  resource: string
  actions: string[]
}

export default defineNuxtRouteMiddleware(async (to) => {
  const permisoRequerido = to.meta.permiso as PermisoRequerido | undefined
  if (!permisoRequerido) return // la página no declaró restricción puntual

  const { can, cargado, cargarPermisos } = usePermissions()

  if (!cargado.value) {
    await cargarPermisos()
  }

  const tienePermiso = permisoRequerido.actions.some((a) => can(permisoRequerido.resource, a))
  if (!tienePermiso) {
    return navigateTo('/403')
  }
})
