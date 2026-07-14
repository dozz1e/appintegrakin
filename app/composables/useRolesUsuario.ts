// composables/useRolesUsuario.ts
// Asignación de roles a usuarios (multi-rol) - usado desde /admin/usuarios.
// Gateado por RLS: solo quien tiene dashboard_widgets.assign puede escribir
// en profile_roles (ver 20260714000000_multi_rol_usuarios.sql).

export interface RolCatalogo {
  id: string
  name: string
}

export const useRolesUsuario = () => {
  const supabase = useSupabaseClient()

  const fetchCatalogoRoles = async (): Promise<RolCatalogo[]> => {
    const { data, error } = await supabase.from('roles').select('id, name').order('name')
    if (error) throw error
    return data as RolCatalogo[]
  }

  const asignarRol = async (userId: string, roleId: string): Promise<void> => {
    const { error } = await supabase.from('profile_roles').insert({ profile_id: userId, role_id: roleId })
    if (error) throw error
  }

  const quitarRol = async (userId: string, roleId: string): Promise<void> => {
    const { error } = await supabase
      .from('profile_roles')
      .delete()
      .eq('profile_id', userId)
      .eq('role_id', roleId)
    if (error) throw error
  }

  return { fetchCatalogoRoles, asignarRol, quitarRol }
}
