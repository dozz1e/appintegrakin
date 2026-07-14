// composables/useMiPerfil.ts
// Reemplaza intencionalmente al usePerfilActual.ts huérfano que borramos -
// mismo propósito, pero con el guard correcto y usando .sub (no .id).

export interface MiPerfil {
  id: string
  full_name: string | null
  email: string | null
  roles: string[]
  avatar_url: string | null
  settings: Record<string, unknown>
}

type FilaPerfil = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  settings: Record<string, unknown> | null
  profile_roles: { role: { name: string } | null }[] | null
}

function mapearPerfil(data: FilaPerfil): MiPerfil {
  const roles = (data.profile_roles ?? [])
    .map((pr) => pr.role?.name)
    .filter((n): n is string => !!n)
    .sort()
  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    avatar_url: data.avatar_url,
    settings: data.settings ?? {},
    roles,
  }
}

const SELECT_PERFIL = 'id, full_name, email, avatar_url, settings, profile_roles(role:roles(name))'

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
      .select(SELECT_PERFIL)
      .eq('id', user.value.sub)
      .single()

    if (error) {
      console.error('Error cargando mi perfil', error)
      return
    }
    perfil.value = mapearPerfil(data as unknown as FilaPerfil)
  }

  const actualizarMiPerfil = async (payload: { full_name?: string; avatar_url?: string }) => {
    if (!user.value?.sub) throw new Error('No hay sesión activa')
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.value.sub)
      .select(SELECT_PERFIL)
      .single()

    if (error) throw error
    perfil.value = mapearPerfil(data as unknown as FilaPerfil)
  }

  const actualizarConfiguracion = async (patch: Record<string, unknown>) => {
    if (!user.value?.sub) throw new Error('No hay sesión activa')
    const nuevoSettings = { ...(perfil.value?.settings ?? {}), ...patch }
    const { data, error } = await supabase
      .from('profiles')
      .update({ settings: nuevoSettings })
      .eq('id', user.value.sub)
      .select(SELECT_PERFIL)
      .single()

    if (error) throw error
    perfil.value = mapearPerfil(data as unknown as FilaPerfil)
  }

  const subirFotoPerfil = async (archivo: File): Promise<string> => {
    if (!user.value?.sub) throw new Error('No hay sesión activa')
    const path = `${user.value.sub}/${Date.now()}-${archivo.name}`
    const { error } = await supabase.storage.from('perfiles-imagenes').upload(path, archivo)
    if (error) throw error

    const { data } = supabase.storage.from('perfiles-imagenes').getPublicUrl(path)
    return data.publicUrl
  }

  return { perfil, cargarMiPerfil, actualizarMiPerfil, actualizarConfiguracion, subirFotoPerfil }
}
