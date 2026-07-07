// composables/useUsuarios.ts
// Lectura de profiles - usado para selectores de "asignar a" en leads/tickets.
// No incluye create/update/delete: eso se maneja fuera del cliente (ver migración
// 20260702000900_profiles_rls.sql).

export interface Usuario {
  id: string
  full_name: string | null
  email: string | null
  role: { name: string } | null
}

export const useUsuarios = () => {
  const supabase = useSupabaseClient()

  const fetchUsuarios = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role:roles(name)')
      .eq('active', true)
      .order('full_name')
    if (error) throw error
    return data as unknown as Usuario[]
  }

  const fetchUsuariosPorRol = async (roleName: string) => {
    const todos = await fetchUsuarios()
    return todos.filter((u) => u.role?.name === roleName)
  }

  return { fetchUsuarios, fetchUsuariosPorRol }
}
