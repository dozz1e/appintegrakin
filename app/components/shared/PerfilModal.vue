<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ cerrar: [] }>()

const { perfil, actualizarMiPerfil, subirFotoPerfil } = useMiPerfil()
const { success, error } = useToast()

const nombre = ref('')
const guardando = ref(false)
const subiendoFoto = ref(false)
const inputArchivo = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  (abierto) => {
    if (abierto) nombre.value = perfil.value?.full_name ?? ''
  }
)

async function onCambiarFoto(e: Event) {
  const archivo = (e.target as HTMLInputElement).files?.[0]
  if (!archivo) return
  subiendoFoto.value = true
  try {
    const url = await subirFotoPerfil(archivo)
    await actualizarMiPerfil({ avatar_url: url })
    success('Foto actualizada')
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e)
    error(`No se pudo subir la foto: ${detalle}`)
  } finally {
    subiendoFoto.value = false
    if (inputArchivo.value) inputArchivo.value.value = ''
  }
}

async function onGuardar() {
  if (!nombre.value.trim()) return
  guardando.value = true
  try {
    await actualizarMiPerfil({ full_name: nombre.value.trim() })
    success('Perfil actualizado')
    emit('cerrar')
  } catch (e) {
    error('No se pudo guardar el perfil')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <SharedModal :open="open" titulo="Mi perfil" @cerrar="$emit('cerrar')">
    <div class="flex flex-col items-center gap-2 mb-5">
      <SharedAvatar
        :nombre="perfil?.full_name || perfil?.email || '?'"
        :imagen-url="perfil?.avatar_url"
        size="md"
      />
      <button
        type="button"
        :disabled="subiendoFoto"
        class="text-xs text-primary hover:underline disabled:opacity-50"
        @click="inputArchivo?.click()"
      >
        {{ subiendoFoto ? 'Subiendo...' : 'Cambiar foto' }}
      </button>
      <input ref="inputArchivo" type="file" accept="image/*" class="hidden" @change="onCambiarFoto" />
    </div>

    <div class="space-y-3">
      <div>
        <label class="block text-xs font-medium text-ink-muted mb-1">Nombre</label>
        <input
          v-model="nombre"
          type="text"
          class="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-muted mb-1">Email</label>
        <p class="text-sm text-ink-secondary">{{ perfil?.email }}</p>
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-muted mb-1">Roles</label>
        <div v-if="perfil?.roles?.length" class="flex flex-wrap gap-1.5">
          <SharedBadge
            v-for="rol in perfil.roles"
            :key="rol"
            :label="rol"
            clases="bg-neutral-bg text-neutral-text"
          />
        </div>
        <SharedBadge v-else label="—" clases="bg-neutral-bg text-neutral-text" />
      </div>
    </div>

    <div class="flex justify-end mt-6">
      <button
        type="button"
        :disabled="guardando"
        class="bg-primary hover:bg-primary-hover text-ink-onprimary px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50"
        @click="onGuardar"
      >
        {{ guardando ? 'Guardando...' : 'Guardar' }}
      </button>
    </div>
  </SharedModal>
</template>
