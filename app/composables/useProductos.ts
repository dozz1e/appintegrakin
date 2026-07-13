// composables/useProductos.ts
// Catálogo compartido, sin owner_id - RLS ya filtra qué puede ver/editar
// cada usuario según sus permisos (no se reimplementa acá).

export type EstadoProducto = 'activo' | 'inactivo'

export interface Producto {
  id: string
  nombre: string
  sku: string
  categoria: string | null
  unidad_medida: string | null
  estado: EstadoProducto
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
}

export const useProductos = () => {
  const supabase = useSupabaseClient()

  const fetchProductos = async () => {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('nombre', { ascending: true })
    if (error) throw error
    return data as Producto[]
  }

  const getProducto = async (id: string) => {
    const { data, error } = await supabase.from('productos').select('*').eq('id', id).single()
    if (error) throw error
    return data as Producto
  }

  const createProducto = async (payload: Partial<Producto>) => {
    const { data, error } = await supabase.from('productos').insert(payload).select().single()
    if (error) throw error
    return data as Producto
  }

  const updateProducto = async (id: string, payload: Partial<Producto>, expectedVersion?: number) => {
    let query = supabase
      .from('productos')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (expectedVersion !== undefined) query = query.eq('version', expectedVersion)

    const { data, error } = await query.select().maybeSingle()
    if (error) throw error

    if (expectedVersion !== undefined && !data) {
      throw new Error('CONFLICTO_VERSION')
    }
    return data as Producto
  }

  const deleteProducto = async (id: string) => {
    const { error } = await supabase.from('productos').delete().eq('id', id)
    if (error) throw error
  }

  // Importación masiva con deduplicación por SKU (columna unique) - mismo
  // patrón que importClientes/importLeads. Filas sin sku o sin nombre se
  // descartan antes de intentar el insert.
  const importProductos = async (filas: Record<string, string>[]) => {
    const candidatos = filas
      .filter((f) => f.sku?.trim() && f.nombre?.trim())
      .map((f) => ({
        sku: f.sku.trim(),
        nombre: f.nombre.trim(),
        categoria: f.categoria?.trim() || null,
        unidad_medida: f.unidad_medida?.trim() || null,
        estado: (f.estado?.trim().toLowerCase() === 'inactivo' ? 'inactivo' : 'activo') as EstadoProducto,
      }))

    if (!candidatos.length) return { insertados: 0, omitidos: filas.length }

    const { data, error } = await supabase
      .from('productos')
      .upsert(candidatos, { onConflict: 'sku', ignoreDuplicates: true })
      .select()

    if (error) throw error

    const insertados = data?.length ?? 0
    return { insertados, omitidos: filas.length - insertados }
  }

  return { fetchProductos, getProducto, createProducto, updateProducto, deleteProducto, importProductos }
}
