// Abre inmediatamente el selector nativo (calendario/reloj) de un
// <input type="date"|"time"> al hacer click, en vez de dejar que el
// usuario escriba la fecha/hora a mano.
export function abrirPicker(e: Event) {
  const el = e.currentTarget as HTMLInputElement
  el.showPicker?.()
}
