// middleware/superadmin.ts
// A diferencia de middleware/permission.ts, esto NO manda a /403.
// Un usuario normal que por curiosidad escriba /panel-dev en la URL
// simplemente rebota a "/" -- no hay ninguna señal de que la ruta existe
// o de que le falta un permiso. Eso es intencional.

export default defineNuxtRouteMiddleware(async () => {
  const { esSuperadmin, verificado, verificar } = useSuperadmin()

  if (!verificado.value) {
    await verificar()
  }

  if (!esSuperadmin.value) {
    return navigateTo('/')
  }
})
