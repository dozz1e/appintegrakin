<!-- app/pages/admin/usuarios/index.vue -->
<script setup lang="ts">
import type { Usuario } from '~/composables/useUsuarios'
import type { RolCatalogo } from '~/composables/useRolesUsuario'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'dashboard_widgets', actions: ['assign'] },
})

const { fetchUsuarios } = useUsuarios()
const { fetchCatalogoRoles, asignarRol, quitarRol } = useRolesUsuario()
const { success, error } = useToast()
const usuarioActual = useSupabaseUser()
const { esSuperadmin } = useSuperadmin()

const catalogoRoles = ref<RolCatalogo[]>([])
const usuarios = ref<Usuario[]>([])
const usuarioSeleccionado = ref('')
const rolesDelUsuario = ref<Set<string>>(new Set()) // role_id
const cargando = ref(true)
const aplicando = ref<string | null>(null) // role_id en curso, para deshabilitar su checkbox

// Mismo guard que /admin/permisos: nadie edita sus propios roles desde acá,
// evita que alguien se quite a sí mismo el único rol con dashboard_widgets.assign.
// Un superadmin no corre ese riesgo (bypasea permisos vía tabla superadmins),
// así que puede editar también sus propios roles.
const usuariosSeleccionables = computed(() =>
  esSuperadmin.value ? usuarios.value : usuarios.value.filter((u) => u.id !== usuarioActual.value?.sub)
)

onMounted(async () => {
  catalogoRoles.value = await fetchCatalogoRoles()
  usuarios.value = await fetchUsuarios()
  cargando.value = false
})

const seleccionarUsuario = (userId: string) => {
  usuarioSeleccionado.value = userId
  const usuario = usuarios.value.find((u) => u.id === userId)
  rolesDelUsuario.value = new Set((usuario?.roles ?? []).map((r) => r.id))
}

const tieneRol = (roleId: string): boolean => rolesDelUsuario.value.has(roleId)

const alternarRol = async (roleId: string) => {
  if (!usuarioSeleccionado.value) return
  aplicando.value = roleId
  try {
    if (tieneRol(roleId)) {
      await quitarRol(usuarioSeleccionado.value, roleId)
      rolesDelUsuario.value.delete(roleId)
    } else {
      await asignarRol(usuarioSeleccionado.value, roleId)
      rolesDelUsuario.value.add(roleId)
    }
    rolesDelUsuario.value = new Set(rolesDelUsuario.value)
    success('Roles actualizados')
  } catch (e) {
    rolesDelUsuario.value = new Set(rolesDelUsuario.value)
    error('No se pudo actualizar el rol')
  } finally {
    aplicando.value = null
  }
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <h1 class="text-lg font-semibold mb-2">Roles por usuario</h1>
    <p class="text-sm text-gray-400 mb-6">
      Un usuario puede tener varios roles a la vez. Sus permisos son la unión de los permisos de todos sus roles
      asignados, más los overrides puntuales de /admin/permisos.
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

      <ul v-if="usuarioSeleccionado" class="space-y-1">
        <li
          v-for="rol in catalogoRoles"
          :key="rol.id"
          class="flex items-center justify-between text-sm border rounded px-3 py-2"
        >
          <span class="font-medium">{{ rol.name }}</span>
          <input
            type="checkbox"
            :checked="tieneRol(rol.id)"
            :disabled="aplicando === rol.id"
            @change="alternarRol(rol.id)"
          />
        </li>
      </ul>
    </template>
  </div>
</template>
