<!-- app/pages/admin/permisos/index.vue -->
<script setup lang="ts">
import type { Usuario } from '~/composables/useUsuarios'
import type { PermisoCatalogo } from '~/composables/usePermisosOverrides'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'dashboard_widgets', actions: ['assign'] },
})

const { fetchCatalogoPermisos, fetchHeredadosDeRol, fetchOverridesDeUsuario, setOverride, quitarOverride } =
  usePermisosOverrides()
const { fetchUsuarios } = useUsuarios()
const { success, error } = useToast()
const usuarioActual = useSupabaseUser()

const catalogo = ref<PermisoCatalogo[]>([])
const usuarios = ref<Usuario[]>([])
const usuarioSeleccionado = ref('')
const heredados = ref<Set<string>>(new Set()) // permission_id con acceso vía rol
const overrides = ref<Map<string, 'grant' | 'revoke'>>(new Map()) // permission_id -> effect
const cargando = ref(true)
const cargandoUsuario = ref(false)

// Nadie puede editar sus propios permisos desde acá: evita que la dueña se
// revoque dashboard_widgets.assign a sí misma y quede sin acceso a esta
// misma pantalla (no hay UI para deshacer eso, solo SQL directo).
const usuariosSeleccionables = computed(() => usuarios.value.filter((u) => u.id !== usuarioActual.value?.sub))

const recursos = computed(() => Array.from(new Set(catalogo.value.map((p) => p.resource))).sort())

onMounted(async () => {
  catalogo.value = await fetchCatalogoPermisos()
  usuarios.value = await fetchUsuarios()
  cargando.value = false
})

const seleccionarUsuario = async (userId: string) => {
  usuarioSeleccionado.value = userId
  heredados.value = new Set()
  overrides.value = new Map()
  if (!userId) return

  cargandoUsuario.value = true
  const usuario = usuarios.value.find((u) => u.id === userId)
  if (usuario?.role_id) {
    heredados.value = await fetchHeredadosDeRol(usuario.role_id)
  }
  const filas = await fetchOverridesDeUsuario(userId)
  overrides.value = new Map(filas.map((f) => [f.permission_id, f.effect]))
  cargandoUsuario.value = false
}

const estadoDe = (permissionId: string): 'heredado' | 'grant' | 'revoke' => overrides.value.get(permissionId) ?? 'heredado'

const aplicarEstado = async (permissionId: string, estado: 'heredado' | 'grant' | 'revoke') => {
  if (!usuarioSeleccionado.value || estadoDe(permissionId) === estado) return

  try {
    if (estado === 'heredado') {
      await quitarOverride(usuarioSeleccionado.value, permissionId)
      overrides.value.delete(permissionId)
    } else {
      await setOverride(usuarioSeleccionado.value, permissionId, estado)
      overrides.value.set(permissionId, estado)
    }
    overrides.value = new Map(overrides.value)
    success('Permiso actualizado')
  } catch (e) {
    error('No se pudo actualizar el permiso')
  }
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <h1 class="text-lg font-semibold mb-2">Permisos por usuario</h1>
    <p class="text-sm text-gray-400 mb-6">
      Forzar el acceso de un usuario a una acción puntual, sin cambiar su rol. "Heredado" respeta lo que diga el rol;
      "Otorgar"/"Revocar" lo fuerzan independientemente del rol.
    </p>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>

    <template v-else>
      <select
        :value="usuarioSeleccionado"
        class="w-full border rounded px-2 py-1.5 text-sm mb-6"
        @change="seleccionarUsuario(($event.target as HTMLSelectElement).value)"
      >
        <option value="">Selecciona un usuario</option>
        <option v-for="u in usuariosSeleccionables" :key="u.id" :value="u.id">{{ u.full_name || u.email }}</option>
      </select>

      <p v-if="usuarioSeleccionado && cargandoUsuario" class="text-gray-400">Cargando permisos...</p>

      <div v-else-if="usuarioSeleccionado" class="space-y-6">
        <div v-for="recurso in recursos" :key="recurso">
          <h2 class="text-xs font-semibold text-gray-400 uppercase mb-2">{{ recurso }}</h2>
          <ul class="space-y-1">
            <li
              v-for="p in catalogo.filter((c) => c.resource === recurso)"
              :key="p.id"
              class="flex items-center justify-between text-sm border rounded px-3 py-2"
            >
              <div>
                <span class="font-medium">{{ p.action }}</span>
                <span class="text-gray-400 ml-2">(rol: {{ heredados.has(p.id) ? 'sí' : 'no' }})</span>
              </div>
              <div class="flex gap-1">
                <button
                  class="text-xs px-2 py-1 rounded"
                  :class="estadoDe(p.id) === 'heredado' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'"
                  @click="aplicarEstado(p.id, 'heredado')"
                >
                  Heredado
                </button>
                <button
                  class="text-xs px-2 py-1 rounded"
                  :class="estadoDe(p.id) === 'grant' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'"
                  @click="aplicarEstado(p.id, 'grant')"
                >
                  Otorgar
                </button>
                <button
                  class="text-xs px-2 py-1 rounded"
                  :class="estadoDe(p.id) === 'revoke' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'"
                  @click="aplicarEstado(p.id, 'revoke')"
                >
                  Revocar
                </button>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>
