<script setup lang="ts">
const { toasts, quitar } = useToast()

const estilos: Record<string, string> = {
  success: 'bg-white border-green-200 text-green-700',
  error: 'bg-white border-red-200 text-red-700',
  info: 'bg-white border-[#BEE0F2] text-[#0C5D91]',
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
