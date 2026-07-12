const FIELD_LABELS: Record<string, string> = {
  rut: 'RUT',
  razon_social: 'Razón social',
  nombre_contacto: 'Nombre de contacto',
  telefono: 'Teléfono',
  email: 'Email',
  kame_id: 'ID Kame',
  imagen_url: 'Imagen',
  owner_id: 'Responsable',
  created_by: 'Creado por',
  nombre: 'Nombre',
  origen: 'Origen',
  estado: 'Estado',
  cliente_id: 'Cliente',
  titulo: 'Título',
  descripcion: 'Descripción',
  prioridad: 'Prioridad',
}

const CAMPOS_EXCLUIDOS = new Set(['id', 'created_at', 'updated_at', 'version'])

export interface CampoDiff {
  campo: string
  etiqueta: string
  anterior?: string
  nuevo?: string
  valor?: string
}

function etiquetaDe(campo: string): string {
  return FIELD_LABELS[campo] ?? campo
}

function formatearValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '(vacío)'
  return String(valor)
}

export function calcularDiff(
  accion: 'insert' | 'update' | 'delete',
  datosAnteriores: Record<string, unknown> | null,
  datosNuevos: Record<string, unknown> | null
): CampoDiff[] {
  if (accion === 'insert' && datosNuevos) {
    return Object.keys(datosNuevos)
      .filter((campo) => !CAMPOS_EXCLUIDOS.has(campo))
      .map((campo) => ({
        campo,
        etiqueta: etiquetaDe(campo),
        valor: formatearValor(datosNuevos[campo]),
      }))
  }

  if (accion === 'delete' && datosAnteriores) {
    return Object.keys(datosAnteriores)
      .filter((campo) => !CAMPOS_EXCLUIDOS.has(campo))
      .map((campo) => ({
        campo,
        etiqueta: etiquetaDe(campo),
        valor: formatearValor(datosAnteriores[campo]),
      }))
  }

  if (accion === 'update' && datosAnteriores && datosNuevos) {
    const campos = new Set([...Object.keys(datosAnteriores), ...Object.keys(datosNuevos)])
    return [...campos]
      .filter((campo) => !CAMPOS_EXCLUIDOS.has(campo))
      .filter((campo) => formatearValor(datosAnteriores[campo]) !== formatearValor(datosNuevos[campo]))
      .map((campo) => ({
        campo,
        etiqueta: etiquetaDe(campo),
        anterior: formatearValor(datosAnteriores[campo]),
        nuevo: formatearValor(datosNuevos[campo]),
      }))
  }

  return []
}
