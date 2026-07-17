// composables/usePermisosOverrides.ts
// Overrides individuales de permisos, gestionados desde /admin/permisos.
// Solo funciona para quien tiene el permiso dashboard_widgets.assign (RLS,
// ver 20260709000000_rls_permisos_admin.sql).

export interface PermisoCatalogo {
  id: string
  resource: string
  action: string
}

export interface OverrideUsuario {
  permission_id: string
  effect: 'grant' | 'revoke'
}

export const usePermisosOverrides = () => {
  const supabase = useSupabaseClient()

  const fetchCatalogoPermisos = async () => {
    const { data, error } = await supabase
      .from('permissions')
      .select('id, resource, action')
      .order('resource', { ascending: true })
      .order('action', { ascending: true })
    if (error) throw error
    return data as PermisoCatalogo[]
  }

  const fetchHeredadosDeRoles = async (roleIds: string[]) => {
    if (roleIds.length === 0) return new Set<string>()
    const { data, error } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .in('role_id', roleIds)
    if (error) throw error
    return new Set((data ?? []).map((r) => r.permission_id as string))
  }

  const fetchOverridesDeUsuario = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_permission_overrides')
      .select('permission_id, effect')
      .eq('user_id', userId)
    if (error) throw error
    return data as OverrideUsuario[]
  }

  const setOverride = async (userId: string, permissionId: string, effect: 'grant' | 'revoke') => {
    const { error } = await supabase
      .from('user_permission_overrides')
      .upsert({ user_id: userId, permission_id: permissionId, effect }, { onConflict: 'user_id,permission_id' })
    if (error) throw error
  }

  const quitarOverride = async (userId: string, permissionId: string) => {
    const { error } = await supabase
      .from('user_permission_overrides')
      .delete()
      .eq('user_id', userId)
      .eq('permission_id', permissionId)
    if (error) throw error
  }

  return {
    fetchCatalogoPermisos,
    fetchHeredadosDeRoles,
    fetchOverridesDeUsuario,
    setOverride,
    quitarOverride,
  }
}
