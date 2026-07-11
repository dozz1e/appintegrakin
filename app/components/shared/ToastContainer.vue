<script setup lang="ts">
const { toasts, quitar } = useToast()

const estilos: Record<string, string> = {
  success: 'bg-surface border-success-text/30 text-success-text',
  error: 'bg-surface border-danger-text/30 text-danger-text',
  info: 'bg-surface border-primary/30 text-primary-ink',
}

const iconos: Record<string, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-50 space-y-2 w-80">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="border rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 text-sm"
          :class="estilos[t.tipo]"
        >
          <span class="font-bold">{{ iconos[t.tipo] }}</span>
          <p class="flex-1">{{ t.mensaje }}</p>
          <button class="text-gray-300 hover:text-gray-500" @click="quitar(t.id)">✕</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
