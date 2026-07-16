<script setup lang="ts">
const props = defineProps<{ texto: string }>()

const expandido = ref(false)
const clampeado = ref(false)
const el = ref<HTMLParagraphElement | null>(null)

function medir() {
  if (!el.value) return
  clampeado.value = el.value.scrollHeight > el.value.clientHeight + 1
}

onMounted(() => nextTick(medir))
watch(() => props.texto, () => {
  expandido.value = false
  nextTick(medir)
})
</script>

<template>
  <div>
    <p ref="el" class="whitespace-pre-wrap break-words" :class="expandido ? '' : 'line-clamp-3'">{{ texto }}</p>
    <button
      v-if="clampeado || expandido"
      type="button"
      class="text-xs text-primary hover:underline mt-0.5"
      @click="expandido = !expandido"
    >
      {{ expandido ? 'Ver menos' : 'Ver más' }}
    </button>
  </div>
</template>
