// composables/useDashboardWidgets.ts

export interface MiWidget {
  key: string
  label: string
  component: string
  resource: string
  tipo: 'kpi' | 'chart'
  orden: number
  config: Record<string, unknown>
}

export interface WidgetCatalogo {
  id: string
  key: string
  label: string
  component: string
  resource: string
  tipo: 'kpi' | 'chart'
  descripcion: string | null
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

  // A partir de acá, solo funciona si quien llama tiene el permiso
  // dashboard_widgets.assign (dueña o superadmin) - lo exige la RLS.
  const fetchCatalogo = async () => {
    const { data, error } = await supabase.from('dashboard_widgets').select('*').order('tipo, label')
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
    fetchCatalogo,
    fetchWidgetsDeUsuario,
    asignarWidget,
    quitarWidget,
  }
}
