// composables/useClientes.ts
// RLS ya filtra qué filas ve cada usuario (view vs view_all) - acá no se reimplementa esa lógica.

export interface Cliente {
  id: string
  rut: string | null
  razon_social: string
  nombre_contacto: string | null
  telefono: string | null
  email: string | null
  kame_id: string | null
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
}

export const useClientes = () => {
  const supabase = useSupabaseClient()

  const fetchClientes = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as Cliente[]
  }

  const getCliente = async (id: string) => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as Cliente
  }

  const createCliente = async (payload: Partial<Cliente>) => {
    const { data, error } = await supabase
      .from('clientes')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data as Cliente
  }

  const updateCliente = async (id: string, payload: Partial<Cliente>, expectedVersion?: number) => {
    let query = supabase
      .from('clientes')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (expectedVersion !== undefined) query = query.eq('version', expectedVersion)

    const { data, error } = await query.select().maybeSingle()
    if (error) throw error

    if (expectedVersion !== undefined && !data) {
      throw new Error('CONFLICTO_VERSION')
    }
    return data as Cliente
  }

  const deleteCliente = async (id: string) => {
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (error) throw error
  }

  // Importación masiva con deduplicación por RUT (columna unique en la tabla).
  // Filas sin rut o sin razón social se descartan antes de intentar el insert.
  // ignoreDuplicates hace que Postgres salte silenciosamente los rut que ya
  // existen, en vez de fallar el batch completo por un conflicto de unique.
  const importClientes = async (filas: Record<string, string>[]) => {
    const user = useSupabaseUser()

    const candidatos = filas
      .filter((f) => f.razon_social?.trim())
      .map((f) => ({
        rut: f.rut?.trim() || null,
        razon_social: f.razon_social.trim(),
        nombre_contacto: f.nombre_contacto?.trim() || null,
        telefono: f.telefono?.trim() || null,
        email: f.email?.trim() || null,
        owner_id: user.value?.sub,
        created_by: user.value?.sub,
      }))

    if (!candidatos.length) return { insertados: 0, omitidos: filas.length }

    const { data, error } = await supabase
      .from('clientes')
      .upsert(candidatos, { onConflict: 'rut', ignoreDuplicates: true })
      .select()

    if (error) throw error

    const insertados = data?.length ?? 0
    return { insertados, omitidos: filas.length - insertados }
  }

  return { fetchClientes, getCliente, createCliente, updateCliente, deleteCliente, importClientes }
}