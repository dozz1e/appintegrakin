// composables/useCsv.ts
// Utilidades genéricas de CSV, reutilizables por clientes/leads/tickets.
import Papa from 'papaparse'

export const useCsv = () => {
  const parsearCSV = (archivo: File): Promise<Record<string, string>[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(archivo, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
        complete: (resultado) => resolve(resultado.data as Record<string, string>[]),
        error: (err) => reject(err),
      })
    })
  }

  const descargarCSV = (nombreArchivo: string, filas: Record<string, unknown>[]) => {
    const csv = Papa.unparse(filas)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return { parsearCSV, descargarCSV }
}
