// utils/kpiDelta.ts
//
// Delta porcentual período-sobre-período (últimos 30 días vs los 30
// anteriores) a partir de un array de timestamps. Uso: KPIs del dashboard
// que necesitan mostrar una flechita de tendencia real, no inventada.
// null = no hay datos en el período anterior para comparar (evita división
// por cero / porcentajes sin sentido tipo "+Infinity%").

export function calcularDeltaPct(fechas: (string | null | undefined)[]): number | null {
  const dia = 24 * 60 * 60 * 1000
  const ahora = Date.now()
  const inicioActual = ahora - 30 * dia
  const inicioAnterior = ahora - 60 * dia

  let actual = 0
  let anterior = 0
  for (const f of fechas) {
    if (!f) continue
    const t = new Date(f).getTime()
    if (t >= inicioActual) actual++
    else if (t >= inicioAnterior) anterior++
  }

  if (anterior === 0) return null
  return Math.round(((actual - anterior) / anterior) * 100)
}
