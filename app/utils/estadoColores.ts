// utils/estadoColores.ts
//
// Un solo lugar para decidir qué color le corresponde a cada estado.
// Auto-importado por Nuxt (igual que composables/, pero para funciones puras
// sin estado). Devuelve clases de Tailwind con color arbitrario (#1075B5 es
// el primario de la marca), no depende de tailwind.config.

export interface EstiloEstado {
  label: string
  clases: string // clases completas para el badge
}

const PRIMARIO_BG = 'bg-[#EAF4FA] text-[#0C5D91]'
const VERDE_BG = 'bg-green-50 text-green-700'
const AMBAR_BG = 'bg-amber-50 text-amber-700'
const ROJO_BG = 'bg-red-50 text-red-700'
const MORADO_BG = 'bg-purple-50 text-purple-700'
const GRIS_BG = 'bg-gray-100 text-gray-600'

export function colorLead(estado: string): EstiloEstado {
  const mapa: Record<string, EstiloEstado> = {
    nuevo: { label: 'Nuevo', clases: GRIS_BG },
    contactado: { label: 'Contactado', clases: PRIMARIO_BG },
    cotizado: { label: 'Cotizado', clases: MORADO_BG },
    negociacion: { label: 'Negociación', clases: AMBAR_BG },
    ganado: { label: 'Ganado', clases: VERDE_BG },
    perdido: { label: 'Perdido', clases: ROJO_BG },
  }
  return mapa[estado] ?? { label: estado, clases: GRIS_BG }
}

export function colorTicket(estado: string): EstiloEstado {
  const mapa: Record<string, EstiloEstado> = {
    abierto: { label: 'Abierto', clases: ROJO_BG },
    en_proceso: { label: 'En proceso', clases: PRIMARIO_BG },
    esperando_cliente: { label: 'Esperando cliente', clases: AMBAR_BG },
    resuelto: { label: 'Resuelto', clases: VERDE_BG },
    cerrado: { label: 'Cerrado', clases: GRIS_BG },
  }
  return mapa[estado] ?? { label: estado, clases: GRIS_BG }
}

export function colorPrioridad(prioridad: string): EstiloEstado {
  const mapa: Record<string, EstiloEstado> = {
    baja: { label: 'Baja', clases: GRIS_BG },
    media: { label: 'Media', clases: PRIMARIO_BG },
    alta: { label: 'Alta', clases: AMBAR_BG },
    urgente: { label: 'Urgente', clases: ROJO_BG },
  }
  return mapa[prioridad] ?? { label: prioridad, clases: GRIS_BG }
}

export function colorCanal(canal: string): EstiloEstado {
  const mapa: Record<string, EstiloEstado> = {
    correo: { label: 'Correo', clases: PRIMARIO_BG },
    texto: { label: 'Texto', clases: VERDE_BG },
    telefono: { label: 'Teléfono', clases: MORADO_BG },
  }
  return mapa[canal] ?? { label: canal, clases: GRIS_BG }
}