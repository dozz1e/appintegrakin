// composables/useDashboardWidgets.ts

export interface MiWidget {
  widget_id: string
  key: string
  label: string
  component: string
  resource: string
  tipo: 'kpi' | 'chart' | 'tabla'
  orden: number
  config: Record<string, unknown>
  visible: boolean
}

export interface WidgetCatalogo {
  id: string
  key: string
  label: string
  component: string
  resource: string
  tipo: 'kpi' | 'chart' | 'tabla'
  descripcion: string | null
  dashboard: string
}

export const useDashboardWidgets = () => {
  const supabase = useSupabaseClient()
  const misWidgets = useState<MiWidget[]>('mis-widgets', () => [])
  const cargado = useState('widgets-cargados', () => false)

  // Uso normal: qué widgets renderizar en mi propio dashboard.
  const cargarMisWidgets = async () => {
    const { data, error } = await supabase.rpc('mis_widgets')
    if (error) {
      console.error('Error cargando widgets', error)
      misWidgets.value = []
      return
    }
    misWidgets.value = (data ?? []) as MiWidget[]
    cargado.value = true
  }

  // Self-service: reordenar/ocultar los propios widgets no requiere el
  // permiso dashboard_widgets.assign - la policy RLS ya lo restringe a
  // la fila propia (user_id = auth.uid()).
  const reordenarMisWidgets = async (items: { widgetId: string; orden: number }[]) => {
    const user = useSupabaseUser()
    const uid = user.value?.sub
    if (!uid) return
    await Promise.all(
      items.map(({ widgetId, orden }) =>
        supabase.from('user_dashboard_widgets').update({ orden }).eq('widget_id', widgetId).eq('user_id', uid)
      )
    )
  }

  const setVisibilidadMiWidget = async (widgetId: string, visible: boolean) => {
    const user = useSupabaseUser()
    const uid = user.value?.sub
    if (!uid) return
    const { error } = await supabase
      .from('user_dashboard_widgets')
      .update({ visible })
      .eq('widget_id', widgetId)
      .eq('user_id', uid)
    if (error) throw error
  }

  // A partir de acá, solo funciona si quien llama tiene el permiso
  // dashboard_widgets.assign (dueña o superadmin) - lo exige la RLS.
  const fetchCatalogo = async () => {
    const { data, error } = await supabase.from('dashboard_widgets').select('*').order('dashboard, tipo, label')
    if (error) throw error
    return data as WidgetCatalogo[]
  }

  const fetchWidgetsDeUsuario = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_dashboard_widgets')
      .select('widget_id, orden')
      .eq('user_id', userId)
    if (error) throw error
    return data as { widget_id: string; orden: number }[]
  }

  const asignarWidget = async (userId: string, widgetId: string, orden = 0) => {
    const { error } = await supabase
      .from('user_dashboard_widgets')
      .upsert({ user_id: userId, widget_id: widgetId, orden }, { onConflict: 'user_id,widget_id' })
    if (error) throw error
  }

  const quitarWidget = async (userId: string, widgetId: string) => {
    const { error } = await supabase
      .from('user_dashboard_widgets')
      .delete()
      .eq('user_id', userId)
      .eq('widget_id', widgetId)
    if (error) throw error
  }

  return {
    misWidgets,
    cargado,
    cargarMisWidgets,
    reordenarMisWidgets,
    setVisibilidadMiWidget,
    fetchCatalogo,
    fetchWidgetsDeUsuario,
    asignarWidget,
    quitarWidget,
  }
}
