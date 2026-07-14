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

  const fetchUsuariosPorRol = async (roleName: string) => {
    const todos = await fetchUsuarios()
    return todos.filter((u) => u.roles.some((r) => r.name === roleName))
  }

  return { fetchUsuarios, fetchUsuariosPorRol }
}
