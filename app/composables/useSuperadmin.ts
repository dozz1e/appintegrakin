// composables/useSuperadmin.ts
// Cachea el resultado igual que usePermissions - una consulta por sesión, no por render.

export const useSuperadmin = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const esSuperadmin = useState('es-superadmin', () => false)
  const verificado = useState('superadmin-verificado', () => false)

  const verificar = async () => {
    if (!user.value) {
      esSuperadmin.value = false
      verificado.value = false
      return
    }
    // OJO: user.value es el JWT decodificado en esta versión del módulo, el
    // identificador viene en `.sub`, no en `.id`.
    const { data } = await supabase
      .from('superadmins')
      .select('user_id')
      .eq('user_id', user.value.sub)
      .maybeSingle()

    esSuperadmin.value = !!data
    verificado.value = true
  }

  return { esSuperadmin, verificado, verificar }
}
