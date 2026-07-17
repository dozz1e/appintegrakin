// composables/useClientes.ts
// RLS ya filtra qué filas ve cada usuario (view vs view_all) - acá no se reimplementa esa lógica.

export interface Cliente {
  id: string
  rut: string | null
  razon_social: string
  nombre_contacto: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  ciudad: string | null
  comuna: string | null
  imagen_url: string | null
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

  const fetchClientesPorIds = async (ids: string[]): Promise<Pick<Cliente, 'id' | 'razon_social'>[]> => {
    if (!ids.length) return []
    const { data, error } = await supabase.from('clientes').select('id, razon_social').in('id', ids)
    if (error) throw error
    return data as Pick<Cliente, 'id' | 'razon_social'>[]
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

  // Búsqueda acotada para el picker de cliente (ClienteBuscador.vue) - no
  // reutiliza useBusquedaGlobal porque ese busca en paralelo sobre
  // clientes/leads/tickets con límite bajo (5), pensado para el buscador
  // global, no para un picker dedicado a clientes.
  const buscarClientes = async (termino: string): Promise<Cliente[]> => {
    const q = termino.trim().replace(/[%_]/g, (m) => `\\${m}`)
    if (q.length < 2) return []

    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .or(`razon_social.ilike.%${q}%,nombre_contacto.ilike.%${q}%,rut.ilike.%${q}%`)
      .order('razon_social', { ascending: true })
      .limit(8)

    if (error) throw error
    return data as Cliente[]
  }

  const createCliente = async (payload: Partial<Cliente>) => {
    const user = useSupabaseUser()
    const { data, error } = await supabase
      .from('clientes')
      .insert({ ...payload, owner_id: payload.owner_id ?? user.value?.sub, created_by: user.value?.sub })
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

  // requiere permiso clientes.assign (se valida por RLS del lado servidor)
  const asignarCliente = (id: string, vendedorId: string | null) => updateCliente(id, { owner_id: vendedorId })

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
        email: f.email?.trim().toLowerCase() || null,
        direccion: f.direccion?.trim() || null,
        ciudad: f.ciudad?.trim() || null,
        comuna: f.comuna?.trim() || null,
        owner_id: user.value?.sub,
        created_by: user.value?.sub,
      }))

    if (!candidatos.length) return { insertados: 0, omitidos: filas.length }

    const conRut = candidatos.filter((c) => c.rut)
    const sinRut = candidatos.filter((c) => !c.rut)

    let insertados = 0

    if (conRut.length) {
      const { data, error } = await supabase
        .from('clientes')
        .upsert(conRut, { onConflict: 'rut', ignoreDuplicates: true })
        .select()
      if (error) throw error
      insertados += data?.length ?? 0
    }

    if (sinRut.length) {
      // `rut` es unique pero NULL no deduplica contra NULL (comportamiento
      // estándar SQL) - onConflict:'rut' no filtra nada acá. Sin una columna
      // para deduplicar, se usa el email como identificador: se compara
      // contra los clientes sin RUT ya existentes y contra el resto del
      // mismo archivo (primera ocurrencia gana). Filas sin RUT y sin email
      // no tienen forma de deduplicarse - se insertan igual.
      const { data: existentes, error: errorExistentes } = await supabase
        .from('clientes')
        .select('email')
        .is('rut', null)
        .not('email', 'is', null)
      if (errorExistentes) throw errorExistentes

      const emailsExistentes = new Set((existentes ?? []).map((c) => c.email!.toLowerCase()))
      const emailsVistos = new Set<string>()

      const sinRutFiltrados = sinRut.filter((c) => {
        if (!c.email) return true
        if (emailsExistentes.has(c.email) || emailsVistos.has(c.email)) return false
        emailsVistos.add(c.email)
        return true
      })

      if (sinRutFiltrados.length) {
        const { data, error } = await supabase.from('clientes').insert(sinRutFiltrados).select()
        if (error) throw error
        insertados += data?.length ?? 0
      }
    }

    return { insertados, omitidos: filas.length - insertados }
  }

  const subirImagenCliente = async (clienteId: string, archivo: File) => {
    const path = `${clienteId}/${Date.now()}-${archivo.name}`
    const { error } = await supabase.storage.from('clientes-imagenes').upload(path, archivo)
    if (error) throw error

    const { data } = supabase.storage.from('clientes-imagenes').getPublicUrl(path)
    return data.publicUrl
  }

  return { fetchClientes, fetchClientesPorIds, getCliente, createCliente, updateCliente, asignarCliente, deleteCliente, importClientes, subirImagenCliente, buscarClientes }
}