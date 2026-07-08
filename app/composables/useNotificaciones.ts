// composables/useNotificaciones.ts
export interface Notificacion {
  id: string
  user_id: string
  tipo: 'lead_asignado' | 'ticket_asignado' | 'tarea_asignada' | 'tarea_vencida'
  titulo: string
  mensaje: string | null
  entidad_tipo: 'lead' | 'cliente' | 'ticket' | 'tarea'
  entidad_id: string
  leida: boolean
  created_at: string
}

export const useNotificaciones = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const fetchNotificaciones = async (): Promise<Notificacion[]> => {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) throw error
    return (data ?? []) as Notificacion[]
  }

  const marcarLeida = async (id: string) => {
    const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
    if (error) throw error
  }

  const marcarTodasLeidas = async () => {
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('user_id', user.value?.sub)
      .eq('leida', false)
    if (error) throw error
  }

  // Suscripción en vivo: cuando llega una notificación nueva para este
  // usuario, se ejecuta el callback (usado para sumar al contador sin
  // tener que recargar la página).
  const suscribirNotificaciones = (onNueva: (n: Notificacion) => void) => {
    const canal = supabase
      .channel('notificaciones-en-vivo')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `user_id=eq.${user.value?.sub}` },
        (payload) => onNueva(payload.new as Notificacion)
      )
      .subscribe()

    return () => supabase.removeChannel(canal)
  }

  return { fetchNotificaciones, marcarLeida, marcarTodasLeidas, suscribirNotificaciones }
}
