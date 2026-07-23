export type EntidadImagenTipo = 'cliente_interaccion' | 'lead_interaccion' | 'ticket' | 'ticket_post_venta' | 'capacitacion_nota'

export interface EntidadImagen {
  id: string
  entidad_tipo: EntidadImagenTipo
  entidad_id: string
  url: string
  created_by: string | null
  created_at: string
}

export function useEntidadImagenes() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  async function fetchImagenes(entidadTipo: EntidadImagenTipo, entidadId: string): Promise<EntidadImagen[]> {
    const { data, error } = await supabase
      .from('entidad_imagenes')
      .select('*')
      .eq('entidad_tipo', entidadTipo)
      .eq('entidad_id', entidadId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data ?? []
  }

  async function subirImagen(entidadTipo: EntidadImagenTipo, entidadId: string, archivo: File): Promise<EntidadImagen> {
    const path = `${entidadTipo}/${entidadId}/${Date.now()}-${archivo.name}`
    const { error: errorSubida } = await supabase.storage.from('entidad-imagenes').upload(path, archivo)
    if (errorSubida) throw errorSubida

    const { data: publica } = supabase.storage.from('entidad-imagenes').getPublicUrl(path)

    const { data, error } = await supabase
      .from('entidad_imagenes')
      .insert({
        entidad_tipo: entidadTipo,
        entidad_id: entidadId,
        url: publica.publicUrl,
        created_by: user.value?.sub,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function eliminarImagen(id: string): Promise<void> {
    const { error } = await supabase.from('entidad_imagenes').delete().eq('id', id)
    if (error) throw error
  }

  return { fetchImagenes, subirImagen, eliminarImagen }
}
