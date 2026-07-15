// composables/useConfiguracionArchivado.ts
//
// Días globales (no por usuario) antes de archivar cerrados, uno por
// módulo. Los usa el cron fn_archivar_cerrados. Ver spec
// 2026-07-15-historial-estados-archivado-design.md.

export type ModuloArchivado = 'leads' | 'tickets' | 'tickets_post_venta'

export interface ConfiguracionArchivado {
  modulo: ModuloArchivado
  dias: number
}

export const useConfiguracionArchivado = () => {
  const supabase = useSupabaseClient()

  const fetchConfiguracion = async (): Promise<ConfiguracionArchivado[]> => {
    const { data, error } = await supabase.from('configuracion_archivado').select('*')
    if (error) throw error
    return data as ConfiguracionArchivado[]
  }

  const actualizarDias = async (modulo: ModuloArchivado, dias: number): Promise<void> => {
    const { error } = await supabase.from('configuracion_archivado').update({ dias }).eq('modulo', modulo)
    if (error) throw error
  }

  return { fetchConfiguracion, actualizarDias }
}
