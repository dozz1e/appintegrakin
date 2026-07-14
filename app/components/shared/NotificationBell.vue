<script setup lang="ts">
import type { Notificacion } from '~/composables/useNotificaciones'

const { fetchNotificaciones, marcarLeida, marcarTodasLeidas, eliminarNotificacion, suscribirNotificaciones } =
  useNotificaciones()
const { error: toastError } = useToast()
const router = useRouter()

const notificaciones = ref<Notificacion[]>([])
const abierto = ref(false)
const cargando = ref(true)
const contenedor = ref<HTMLElement | null>(null)
let dejarDeEscuchar: (() => void) | null = null

const noLeidas = computed(() => notificaciones.value.filter((n) => !n.leida).length)

const etiquetaTipo: Record<Notificacion['tipo'], string> = {
  lead_asignado: '🧲',
  ticket_asignado: '🎫',
  tarea_asignada: '✅',
  tarea_vencida: '⏰',
  capacitacion_asignada: '🎓',
  capacitacion_vencida: '⏰',
}

const rutaEntidad: Record<Notificacion['entidad_tipo'], string> = {
  lead: '/leads',
  cliente: '/clientes',
  ticket: '/tickets',
  tarea: '', // las tareas no tienen página propia, se resuelve por su entidad relacionada si hace falta
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function cargar() {
  cargando.value = true
  notificaciones.value = await fetchNotificaciones()
  cargando.value = false
}

onMounted(async () => {
  await cargar()
  dejarDeEscuchar = suscribirNotificaciones((nueva) => {
    notificaciones.value = [nueva, ...notificaciones.value]
  })
  document.addEventListener('click', onClickFuera)
})

onUnmounted(() => {
  dejarDeEscuchar?.()
  document.removeEventListener('click', onClickFuera)
})

function onClickFuera(e: MouseEvent) {
  if (contenedor.value && !contenedor.value.contains(e.target as Node)) abierto.value = false
}

async function onClickNotificacion(n: Notificacion) {
  if (!n.leida) {
    await marcarLeida(n.id)
    n.leida = true
  }
  abierto.value = false
  const base = rutaEntidad[n.entidad_tipo]
  if (base) router.push(`${base}/${n.entidad_id}`)
}

async function onMarcarTodas() {
  await marcarTodasLeidas()
  notificaciones.value = notificaciones.value.map((n) => ({ ...n, leida: true }))
}

async function onEliminar(n: Notificacion) {
  const anteriores = notificaciones.value
  notificaciones.value = notificaciones.value.filter((x) => x.id !== n.id)
  try {
    await eliminarNotificacion(n.id)
  } catch {
    notificaciones.value = anteriores
    toastError('No se pudo eliminar la notificación')
  }
}
</script>

<template>
  <div ref="contenedor" class="relative">
    <button
      class="relative w-9 h-9 flex items-center justify-center rounded-full text-ink-secondary hover:bg-surface-2 hover:text-ink transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
      @click="abierto = !abierto"
    >
      <span class="text-lg">🔔</span>
      <span
        v-if="noLeidas > 0"
        class="absolute -top-0.5 -right-0.5 bg-danger text-ink-onprimary text-[10px] font-semibold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center"
      >
        {{ noLeidas > 9 ? '9+' : noLeidas }}
      </span>
    </button>

    <div
      v-if="abierto"
      class="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto"
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-border">
        <p class="text-sm font-semibold text-ink">Notificaciones</p>
        <button
          v-if="noLeidas > 0"
          class="text-xs text-primary hover:underline"
          @click="onMarcarTodas"
        >
          Marcar todas como leídas
        </button>
      </div>

      <p v-if="cargando" class="text-xs text-ink-muted px-4 py-3">Cargando...</p>
      <p v-else-if="!notificaciones.length" class="text-xs text-ink-muted px-4 py-3">Sin notificaciones todavía.</p>

      <div
        v-for="n in notificaciones"
        v-else
        :key="n.id"
        class="w-full text-left px-4 py-3 flex gap-3 border-b border-border hover:bg-surface-2 transition-colors duration-150 cursor-pointer"
        :class="{ 'bg-primary-subtle/60': !n.leida }"
        @click="onClickNotificacion(n)"
      >
        <span class="text-base shrink-0">{{ etiquetaTipo[n.tipo] }}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-ink truncate">{{ n.titulo }}</p>
          <p v-if="n.mensaje" class="text-xs text-ink-secondary truncate">{{ n.mensaje }}</p>
          <p class="text-[11px] text-ink-muted mt-0.5">{{ formatearFecha(n.created_at) }}</p>
        </div>
        <span v-if="!n.leida" class="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
        <button
          class="text-ink-muted hover:text-ink shrink-0 leading-none"
          @click.stop="onEliminar(n)"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>