// Minusculas + sin tildes, para comparar texto de forma laxa (busquedas
// no deben exigir acentos ni mayusculas exactas). Debe dar el mismo
// resultado que public.inmutable_unaccent() en la base de datos para que
// el filtro local y las columnas busqueda_normalizada generadas coincidan.
const DIACRITICOS = /[\u0300-\u036f]/g

export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toLowerCase()
}
