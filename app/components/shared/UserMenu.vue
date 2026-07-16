<script setup lang="ts">
const { perfil } = useMiPerfil()
const { logout } = useAuth()

const abierto = ref(false)
const perfilAbierto = ref(false)
const configuracionAbierta = ref(false)
const contenedor = ref<HTMLElement | null>(null)

onMounted(() => {
  document.addEventListener('click', onClickFuera)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickFuera)
})

function onClickFuera(e: MouseEvent) {
  if (contenedor.value && !contenedor.value.contains(e.target as Node)) abierto.value = false
}

function abrirPerfil() {
  abierto.value = false
  perfilAbierto.value = true
}

function abrirConfiguracion() {
  abierto.value = false
  configuracionAbierta.value = true
}
</script>

<template>
  <div ref="contenedor" class="relative">
    <button
      class="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-surface-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
      @click="abierto = !abierto"
    >
      <SharedAvatar
        v-if="perfil?.full_name || perfil?.email"
        :nombre="perfil?.full_name || perfil?.email || '?'"
        :imagen-url="perfil?.avatar_url"
      />
      <div class="text-right hidden sm:block">
        <p class="text-sm font-medium text-ink leading-tight">
          {{ perfil?.full_name || perfil?.email || '...' }}
        </p>
      </div>
    </button>

    <div
      v-if="abierto"
      class="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-xl shadow-lg z-50 py-1"
    >
      <div class="px-4 py-3 border-b border-border">
        <p class="text-sm font-medium text-ink truncate">{{ perfil?.full_name || perfil?.email }}</p>
        <p class="text-xs text-ink-muted truncate">{{ perfil?.email }}</p>
      </div>
      <button
        type="button"
        class="w-full text-left px-4 py-2 text-sm text-ink hover:bg-surface-2 transition-colors duration-150"
        @click="abrirPerfil"
      >
        Perfil
      </button>
      <button
        type="button"
        class="w-full text-left px-4 py-2 text-sm text-ink hover:bg-surface-2 transition-colors duration-150"
        @click="abrirConfiguracion"
      >
        Configuración
      </button>
      <hr class="border-border my-1" />
      <button
        type="button"
        class="w-full text-left px-4 py-2 text-sm text-danger hover:bg-surface-2 transition-colors duration-150"
        @click="logout"
      >
        Salir
      </button>
    </div>

    <SharedPerfilModal :open="perfilAbierto" @cerrar="perfilAbierto = false" />
    <SharedConfiguracionModal :open="configuracionAbierta" @cerrar="configuracionAbierta = false" />
  </div>
</template>
