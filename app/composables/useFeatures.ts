// composables/useFeatures.ts

export interface Feature {
  id: string
  key: string
  label: string
  description: string | null
}

export interface UserFeature {
  id: string
  user_id: string
  feature_id: string
  enabled: boolean
}

export const useFeatures = () => {
  const supabase = useSupabaseClient()
  const misFeatures = useState<Set<string>>('mis-features', () => new Set())
  const cargado = useState('features-cargadas', () => false)

  // Para uso normal de cualquier usuario: qué features tiene prendidas.
  const cargarMisFeatures = async () => {
    const { data, error } = await supabase.rpc('mis_features')
    if (error) {
      console.error('Error cargando features', error)
      return
    }
    misFeatures.value = new Set((data ?? []).map((r: { key: string }) => r.key))
    cargado.value = true
  }

  const hasFeature = (key: string) => misFeatures.value.has(key)

  // A partir de acá, solo funciona si quien llama es superadmin (RLS lo exige).
  const fetchTodasLasFeatures = async () => {
    const { data, error } = await supabase.from('features').select('*').order('key')
    if (error) throw error
    return data as Feature[]
  }

  const crearFeature = async (payload: Pick<Feature, 'key' | 'label' | 'description'>) => {
    const { data, error } = await supabase.from('features').insert(payload).select().single()
    if (error) throw error
    return data as Feature
  }

  const fetchFeaturesDeUsuario = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_features')
      .select('*, features(key, label)')
      .eq('user_id', userId)
    if (error) throw error
    return data
  }

  const otorgarFeature = async (userId: string, featureId: string) => {
    const { data, error } = await supabase
      .from('user_features')
      .upsert({ user_id: userId, feature_id: featureId, enabled: true }, { onConflict: 'user_id,feature_id' })
      .select()
      .single()
    if (error) throw error
    return data
  }

  const quitarFeature = async (userId: string, featureId: string) => {
    const { error } = await supabase
      .from('user_features')
      .delete()
      .eq('user_id', userId)
      .eq('feature_id', featureId)
    if (error) throw error
  }

  return {
    hasFeature,
    cargarMisFeatures,
    cargado,
    fetchTodasLasFeatures,
    crearFeature,
    fetchFeaturesDeUsuario,
    otorgarFeature,
    quitarFeature,
  }
}
