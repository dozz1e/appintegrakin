// composables/useToast.ts
// Sistema simple de notificaciones. Estado compartido vía useState, así que
// cualquier página puede llamar useToast().error(...) sin pasar props ni
// emitir eventos - y SharedToastContainer (montado una vez en el layout)
// las renderiza donde sea que aparezcan.

export type TipoToast = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  tipo: TipoToast
  mensaje: string
}

let contador = 0

export const useToast = () => {
  const toasts = useState<Toast[]>('toasts', () => [])
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const route = useRoute()

  const quitar = (id: number) => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  const mostrar = (tipo: TipoToast, mensaje: string, duracionMs = 4500) => {
    const id = ++contador
    toasts.value = [...toasts.value, { id, tipo, mensaje }]
    setTimeout(() => quitar(id), duracionMs)
  }

  const success = (mensaje: string) => mostrar('success', mensaje)

  // Todo error mostrado como toast queda también en error_log (best-effort:
  // si el insert falla, no debe romper el flujo de la UI, por eso el catch vacío).
  const error = (mensaje: string, contexto?: Record<string, unknown>) => {
    mostrar('error', mensaje, 6000)
    if (user.value?.sub) {
      supabase
        .from('error_log')
        .insert({ user_id: user.value.sub, mensaje, ruta: route.path, contexto: contexto ?? null })
        .then(() => {})
        .catch(() => {})
    }
  }

  const info = (mensaje: string) => mostrar('info', mensaje)

  return { toasts, success, error, info, quitar }
}
