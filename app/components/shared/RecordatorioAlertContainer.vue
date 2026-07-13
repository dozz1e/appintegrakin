<script setup lang="ts">
import type { Tarea } from '~/composables/useTareas'

const { tareasProximas, refrescarTareasProximas, descartarTareaProxima } = useTareas()
const router = useRouter()

let intervalo: ReturnType<typeof setInterval> | null = null

const rutaEntidad: Record<Tarea['entidad_tipo'], string> = {
  lead: '/leads',
  cliente: '/clientes',
  ticket: '/tickets',
}

function onClickTarea(tarea: Tarea) {
  router.push(`${rutaEntidad[tarea.entidad_tipo]}/${tarea.entidad_id}`)
}

onMounted(() => {
  refrescarTareasProximas()
  intervalo = setInterval(refrescarTareasProximas, 60_000)
})

onUnmounted(() => {
  if (intervalo) clearInterval(intervalo)
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-20 right-4 z-50 space-y-3 w-96">
      <TransitionGroup name="recordatorio">
        <SharedRecordatorioAlert
          v-for="t in tareasProximas"
          :key="t.id"
          :tarea="t"
          @cerrar="descartarTareaProxima(t.id)"
          @click="onClickTarea(t)"
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
