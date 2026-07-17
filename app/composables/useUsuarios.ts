// composables/useUsuarios.ts
// Lectura de profiles - usado para selectores de "asignar a" en leads/tickets,
// y para las pantallas de administración de dashboards/permisos/usuarios.
// No incluye create/delete: eso se maneja fuera del cliente (ver migración
// 20260702000900_rls_profiles.sql). La asignación de ROLES sí se hace desde
// /admin/usuarios (ver useRolesUsuario.ts).

export interface Usuario {
  id: string
  full_name: string | null
  email: string | null
  roles: { id: string; name: string }[]
}

type FilaUsuario = {
  id: string
  full_name: string | null
  email: string | null
  profile_roles: { role: { id: string; name: string } | null }[] | null
}

function mapearUsuario(data: FilaUsuario): Usuario {
  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    roles: (data.profile_roles ?? [])
      .map((pr) => pr.role)
      .filter((r): r is { id: string; name: string } => !!r),
  }
}

export const useUsuarios = () => {
  const supabase = useSupabaseClient()

  const fetchUsuarios = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, profile_roles(role:roles(id,name))')
      .eq('active', true)
      .order('full_name')
    if (error) throw error
    return (data as unknown as FilaUsuario[]).map(mapearUsuario)
  }

  // RPC security definer, no el join client-side de fetchUsuarios() -
  // profile_roles tiene RLS que oculta los roles ajenos a quien no sea
  // admin (dashboard_widgets.assign), así que filtrar en JS dejaba a
  // cualquier otro usuario viéndose solo a sí mismo en este selector.
  const fetchUsuariosPorRol = async (roleName: string): Promise<Usuario[]> => {
    const { data, error } = await supabase.rpc('usuarios_por_rol', { p_rol: roleName })
    if (error) throw error
    return (data ?? []).map((u: { id: string; full_name: string | null; email: string | null }) => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      roles: [],
    }))
  }

  return { fetchUsuarios, fetchUsuariosPorRol }
}
