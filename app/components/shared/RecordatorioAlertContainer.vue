<script setup lang="ts">
import type { Tarea } from '~/composables/useTareas'
import type { AvisoRecordatorio } from './RecordatorioAlert.vue'

const {
  tareasProximas,
  refrescarTareasProximas,
  descartarTareaProxima,
  cargarDescartadasGuardadas: cargarDescartesTareas,
} = useTareas()
const {
  citasProximas,
  refrescarCitasProximas,
  descartarCitaProxima,
  cargarDescartadasGuardadas: cargarDescartesCitas,
} = useCitasCapacitacion()
const router = useRouter()

let intervalo: ReturnType<typeof setInterval> | null = null

const rutaEntidad: Record<Tarea['entidad_tipo'], string> = {
  lead: '/leads',
  cliente: '/clientes',
  ticket: '/tickets',
}

interface AvisoConTipo extends AvisoRecordatorio {
  tipo: 'tarea' | 'cita'
}

const avisos = computed<AvisoConTipo[]>(() =>
  [
    ...tareasProximas.value.map((t) => ({ id: t.id, tipo: 'tarea' as const, titulo: t.titulo, fecha_vencimiento: t.fecha_vencimiento })),
    ...citasProximas.value.map((c) => ({
      id: c.id,
      tipo: 'cita' as const,
      titulo: `Capacitación: ${c.producto_nombre} — ${c.cliente_nombre}`,
      fecha_vencimiento: c.fecha_hora,
    })),
  ].sort((a, b) => new Date(a.fecha_vencimiento ?? 0).getTime() - new Date(b.fecha_vencimiento ?? 0).getTime())
)

function onClickAviso(aviso: AvisoConTipo) {
  if (aviso.tipo === 'cita') {
    router.push('/capacitaciones')
    return
  }
  const tarea = tareasProximas.value.find((t) => t.id === aviso.id)
  if (tarea) router.push(`${rutaEntidad[tarea.entidad_tipo]}/${tarea.entidad_id}`)
}

function onCerrarAviso(aviso: AvisoConTipo) {
  if (aviso.tipo === 'cita') descartarCitaProxima(aviso.id)
  else descartarTareaProxima(aviso.id)
}

onMounted(async () => {
  await Promise.all([cargarDescartesTareas(), cargarDescartesCitas()])
  refrescarTareasProximas()
  refrescarCitasProximas()
  intervalo = setInterval(() => {
    refrescarTareasProximas()
    refrescarCitasProximas()
  }, 60_000)
})

onUnmounted(() => {
  if (intervalo) clearInterval(intervalo)
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-20 right-4 left-4 sm:left-auto z-50 space-y-3 w-auto sm:w-96">
      <TransitionGroup name="recordatorio">
        <SharedRecordatorioAlert
          v-for="a in avisos"
          :key="a.id"
          :aviso="a"
          @cerrar="onCerrarAviso(a)"
          @click="onClickAviso(a)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.recordatorio-enter-active,
.recordatorio-leave-active {
  transition: all 0.2s ease;
}
.recordatorio-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.recordatorio-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
