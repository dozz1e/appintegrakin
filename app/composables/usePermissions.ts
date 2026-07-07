// composables/usePermissions.ts
// Carga los permisos efectivos del usuario una vez por sesión y expone can() sincrónico.
// Evita pegarle a Supabase en cada render de UI que necesita ocultar/mostrar botones.

type PermKey = `${string}.${string}` // 'leads.view_all', 'clientes.edit', etc.

export const usePermissions = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const permisos = useState<Set<PermKey>>('permisos-efectivos', () => new Set())
  const cargado = useState('permisos-cargados', () => false)

  const cargarPermisos = async () => {
    if (!user.value) {
      permisos.value = new Set()
      cargado.value = false
      return
    }

    // Trae rol + permisos del rol + overrides individuales en una vista/RPC en Supabase.
    // Se recomienda crear una vista `v_permisos_efectivos(user_id, resource, action)` en SQL
    // que ya resuelva override > rol, para no traer lógica de negocio al cliente.
    //
    // OJO: user.value es el JWT decodificado en esta versión del módulo, así que el
    // identificador viene en `.sub` (estándar JWT), NO en `.id` como el objeto User
    // clásico de supabase-js.
    const { data, error } = await supabase.rpc('permisos_efectivos_usuario', {
      p_user: user.value.sub,
    })

    if (error) {
      console.error('Error cargando permisos', error)
      permisos.value = new Set()
      return
    }

    permisos.value = new Set(
      (data ?? []).map((row: { resource: string; action: string }) => `${row.resource}.${row.action}` as PermKey)
    )
    cargado.value = true
  }

  const can = (resource: string, action: string): boolean => {
    return permisos.value.has(`${resource}.${action}` as PermKey)
  }

  return { can, cargarPermisos, cargado }
}
