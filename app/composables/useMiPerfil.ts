// composables/useMiPerfil.ts
// Reemplaza intencionalmente al usePerfilActual.ts huérfano que borramos -
// mismo propósito, pero con el guard correcto y usando .sub (no .id).

export interface MiPerfil {
  full_name: string | null
  email: string | null
  role: string | null
}

export const useMiPerfil = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const perfil = useState<MiPerfil | null>('mi-perfil', () => null)

  const cargarMiPerfil = async () => {
    if (!user.value?.sub) {
      perfil.value = null
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, email, role:roles(name)')
      .eq('id', user.value.sub)
      .single()

    if (error) {
      console.error('Error cargando mi perfil', error)
      return
    }
    perfil.value = {
      full_name: data.full_name,
      email: data.email,
      role: (data.role as unknown as { name: string } | null)?.name ?? null,
    }
  }

  return { perfil, cargarMiPerfil }
}
