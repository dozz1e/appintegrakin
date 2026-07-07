// composables/useAuth.ts

export const useAuth = () => {
  const supabase = useSupabaseClient()
  const router = useRouter()

  const logout = async () => {
    await supabase.auth.signOut()

    // limpia el cache de permisos (usePermissions usa useState, sobrevive
    // entre páginas - hay que resetearlo a mano al cerrar sesión)
    useState<Set<string>>('permisos-efectivos').value = new Set()
    useState('permisos-cargados').value = false
    useState('es-superadmin').value = false
    useState('superadmin-verificado').value = false
    useState<Set<string>>('mis-features').value = new Set()
    useState('features-cargadas').value = false
    useState('mis-widgets').value = []
    useState('widgets-cargados').value = false
    useState('mi-perfil').value = null
    useState<Set<string>>('feature-flags-usuario').value = new Set()
    useState('feature-flags-cargadas').value = false
    useState('perfil-actual').value = null

    await router.push('/login')
  }

  return { logout }
}
