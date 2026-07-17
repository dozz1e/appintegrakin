export interface UmbralAlerta {
  valor: number
  unidad: 'minutos' | 'horas' | 'dias'
}

export const UMBRAL_ALERTA_DEFAULT: UmbralAlerta = { valor: 30, unidad: 'minutos' }

export function umbralAMinutos(u: UmbralAlerta): number {
  if (u.unidad === 'dias') return u.valor * 1440
  if (u.unidad === 'horas') return u.valor * 60
  return u.valor
}

// Umbrales configurados por el usuario (o el default), convertidos a
// minutos y ordenados ascendente — el orden importa para
// calcularTierActual.
export function obtenerUmbralesMinutos(settings: Record<string, unknown> | undefined): number[] {
  const config = settings?.umbrales_alertas
  const umbrales = Array.isArray(config) && config.length > 0 ? (config as UmbralAlerta[]) : [UMBRAL_ALERTA_DEFAULT]
  return umbrales.map(umbralAMinutos).sort((a, b) => a - b)
}

// null = todavía no entró en ningún umbral (no se muestra el aviso).
// Vencida = mismo tier que el umbral configurado más chico (no es un
// tier nuevo): si el usuario ya descartó ese umbral, vencer no debe
// hacer reaparecer el aviso. Si no venció, el tier es el umbral
// configurado más chico que ya fue cruzado (umbral_minutos >=
// minutos_restantes) — el más específico/urgente vigente en este momento.
export function calcularTierActual(msRestante: number, umbralesMinutosAsc: number[]): number | null {
  if (msRestante <= 0) return umbralesMinutosAsc[0]
  const minutosRestantes = msRestante / 60_000
  return umbralesMinutosAsc.find((u) => u >= minutosRestantes) ?? null
}
