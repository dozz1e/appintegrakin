import { colorLead, colorTicket, colorPrioridad } from './estadoColores'

const FIELD_LABELS: Record<string, string> = {
  rut: 'RUT',
  razon_social: 'Razón social',
  nombre_contacto: 'Nombre de contacto',
  telefono: 'Teléfono',
  email: 'Email',
  kame_id: 'ID Kame',
  imagen_url: 'Imagen',
  direccion: 'Dirección',
  ciudad: 'Ciudad',
  comuna: 'Comuna',
  owner_id: 'Responsable',
  created_by: 'Creado por',
  nombre: 'Nombre',
  origen: 'Origen',
  estado: 'Estado',
  cliente_id: 'Cliente',
  titulo: 'Título',
  descripcion: 'Descripción',
  prioridad: 'Prioridad',
  tecnico_id: 'Técnico asignado',
  fecha_cierre: 'Fecha de cierre',
  archivado: 'Archivado',
  sku: 'SKU',
  categoria: 'Categoría',
  unidad_medida: 'Unidad de medida',
  producto_id: 'Producto',
  valor: 'Valor',
  fecha: 'Fecha',
}

const CAMPOS_EXCLUIDOS = new Set(['id', 'created_at', 'updated_at', 'version'])

// Campos que guardan un UUID de otra tabla - se resuelven contra los mapas
// id -> nombre pasados en AuditoriaContexto, en vez de mostrar el UUID pelado.
const CAMPOS_USUARIO = new Set(['owner_id', 'created_by', 'tecnico_id'])

// Estados/prioridad son enums en snake_case (ver app/utils/estadoColores.ts,
// única fuente de verdad para sus labels) - se resuelven por tabla porque
// 'estado' significa cosas distintas en leads vs tickets.
const ESTADO_POR_TABLA: Record<string, (estado: string) => string> = {
  leads: (estado) => colorLead(estado).label,
  tickets: (estado) => colorTicket(estado).label,
}

const PRIORIDAD_POR_TABLA: Record<string, true> = { tickets: true }

export interface AuditoriaContexto {
  tabla: string
  usuarios: Record<string, string>
  clientes: Record<string, string>
  productos: Record<string, string>
}

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

function formatearValor(campo: string, valor: unknown, ctx: AuditoriaContexto): string {
  if (valor === null || valor === undefined || valor === '') return '(vacío)'

  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'

  if (campo === 'estado') return ESTADO_POR_TABLA[ctx.tabla]?.(String(valor)) ?? String(valor)
  if (campo === 'prioridad' && PRIORIDAD_POR_TABLA[ctx.tabla]) return colorPrioridad(String(valor)).label
  if (CAMPOS_USUARIO.has(campo)) return ctx.usuarios[String(valor)] ?? String(valor)
  if (campo === 'cliente_id') return ctx.clientes[String(valor)] ?? String(valor)
  if (campo === 'producto_id') return ctx.productos[String(valor)] ?? String(valor)

  return String(valor)
}

export function calcularDiff(
  accion: 'insert' | 'update' | 'delete',
  datosAnteriores: Record<string, unknown> | null,
  datosNuevos: Record<string, unknown> | null,
  ctx: AuditoriaContexto
): CampoDiff[] {
  if (accion === 'insert' && datosNuevos) {
    return Object.keys(datosNuevos)
      .filter((campo) => !CAMPOS_EXCLUIDOS.has(campo))
      .map((campo) => ({
        campo,
        etiqueta: etiquetaDe(campo),
        valor: formatearValor(campo, datosNuevos[campo], ctx),
      }))
  }

  if (accion === 'delete' && datosAnteriores) {
    return Object.keys(datosAnteriores)
      .filter((campo) => !CAMPOS_EXCLUIDOS.has(campo))
      .map((campo) => ({
        campo,
        etiqueta: etiquetaDe(campo),
        valor: formatearValor(campo, datosAnteriores[campo], ctx),
      }))
  }

  if (accion === 'update' && datosAnteriores && datosNuevos) {
    const campos = new Set([...Object.keys(datosAnteriores), ...Object.keys(datosNuevos)])
    return [...campos]
      .filter((campo) => !CAMPOS_EXCLUIDOS.has(campo))
      .filter((campo) => formatearValor(campo, datosAnteriores[campo], ctx) !== formatearValor(campo, datosNuevos[campo], ctx))
      .map((campo) => ({
        campo,
        etiqueta: etiquetaDe(campo),
        anterior: formatearValor(campo, datosAnteriores[campo], ctx),
        nuevo: formatearValor(campo, datosNuevos[campo], ctx),
      }))
  }

  return []
}
