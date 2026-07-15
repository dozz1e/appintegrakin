// utils/estadoColores.ts
//
// Un solo lugar para decidir qué color le corresponde a cada estado.
// Auto-importado por Nuxt (igual que composables/, pero para funciones puras
// sin estado). Devuelve clases de Tailwind atadas a los tokens de diseño
// (ver app/assets/css/main.css y tailwind.config.ts), con soporte claro/oscuro.

export interface EstiloEstado {
  label: string
  clases: string // clases completas para el badge
}

const PRIMARIO_BG = 'bg-primary-subtle text-primary-ink'
const VERDE_BG = 'bg-success-bg text-success-text'
const AMBAR_BG = 'bg-warning-bg text-warning-text'
const ROJO_BG = 'bg-danger-bg text-danger-text'
const MORADO_BG = 'bg-violet-bg text-violet-text'
const GRIS_BG = 'bg-neutral-bg text-neutral-text'

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
    whatsapp: { label: 'WhatsApp', clases: VERDE_BG },
    instagram: { label: 'Instagram', clases: MORADO_BG },
    facebook: { label: 'Facebook', clases: PRIMARIO_BG },
    llamada: { label: 'Llamada', clases: AMBAR_BG },
    web: { label: 'Web', clases: GRIS_BG },
    correo: { label: 'Correo', clases: PRIMARIO_BG },
  }
  return mapa[canal] ?? { label: canal, clases: GRIS_BG }
}

export function colorCitaCapacitacion(estado: string): EstiloEstado {
  const mapa: Record<string, EstiloEstado> = {
    pendiente: { label: 'Pendiente', clases: PRIMARIO_BG },
    completada: { label: 'Completada', clases: VERDE_BG },
    cancelada: { label: 'Cancelada', clases: GRIS_BG },
  }
  return mapa[estado] ?? { label: estado, clases: GRIS_BG }
}

export function colorTicketPostVenta(estado: string): EstiloEstado {
  const mapa: Record<string, EstiloEstado> = {
    pendiente_ingreso: { label: 'Pendiente de ingreso', clases: GRIS_BG },
    ingreso_equipo: { label: 'Ingreso de equipo', clases: PRIMARIO_BG },
    probando: { label: 'Probando', clases: MORADO_BG },
    espera_repuesto: { label: 'Espera de repuesto', clases: AMBAR_BG },
    listo_despacho: { label: 'Listo para despacho', clases: VERDE_BG },
    despachado: { label: 'Despachado', clases: GRIS_BG },
    desconocido: { label: 'Desconocido', clases: ROJO_BG },
  }
  return mapa[estado] ?? { label: estado, clases: GRIS_BG }
}