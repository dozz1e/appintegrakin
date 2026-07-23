// utils/ordenVendedores.ts
//
// Orden fijo pedido a mano para los charts "por vendedor" (performance,
// clientes captados) - no por valor descendente, sino este orden exacto.
// Vendedores no listados acá caen al final, en el orden en que lleguen.

const ORDEN_VENDEDORES = ['Natalia Quevedo', 'Romina Espinoza', 'Carla Bolivar']

export function indiceOrdenVendedor(nombre: string): number {
  const i = ORDEN_VENDEDORES.indexOf(nombre)
  return i === -1 ? ORDEN_VENDEDORES.length : i
}

// Un color fijo por vendedora, consistente en todos los charts "por
// vendedor" - así la misma persona siempre se identifica con el mismo
// color, no importa el gráfico. Vendedoras no listadas (equipo crece)
// caen en gris neutro.
const PALETA_VENDEDORES: Record<string, string> = {
  'Natalia Quevedo': '#1075b5',
  'Romina Espinoza': '#7c3aed',
  'Carla Bolivar': '#d97706',
}

export function colorVendedor(nombre: string): string {
  return PALETA_VENDEDORES[nombre] ?? '#78716c'
}
