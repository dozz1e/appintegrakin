<script setup lang="ts">
import type { WidgetCatalogo } from '~/composables/useDashboardWidgets'
import type { Usuario } from '~/composables/useUsuarios'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'dashboard_widgets', actions: ['assign'] },
})

const { fetchCatalogo, fetchWidgetsDeUsuario, asignarWidget, quitarWidget } = useDashboardWidgets()
const { fetchUsuarios } = useUsuarios()
const { success, error } = useToast()

const catalogo = ref<WidgetCatalogo[]>([])
const usuarios = ref<Usuario[]>([])
const usuarioSeleccionado = ref('')
const widgetsAsignados = ref<Set<string>>(new Set()) // widget_id
const cargando = ref(true)

onMounted(async () => {
  catalogo.value = await fetchCatalogo()
  usuarios.value = await fetchUsuarios()
  cargando.value = false
})

const seleccionarUsuario = async (userId: string) => {
  usuarioSeleccionado.value = userId
  if (!userId) {
    widgetsAsignados.value = new Set()
    return
  }
  const rows = await fetchWidgetsDeUsuario(userId)
  widgetsAsignados.value = new Set(rows.map((r) => r.widget_id))
}

const toggleWidget = async (widgetId: string) => {
  if (!usuarioSeleccionado.value) return
  try {
    if (widgetsAsignados.value.has(widgetId)) {
      await quitarWidget(usuarioSeleccionado.value, widgetId)
      widgetsAsignados.value.delete(widgetId)
      success('Widget quitado')
    } else {
      await asignarWidget(usuarioSeleccionado.value, widgetId, widgetsAsignados.value.size)
      widgetsAsignados.value.add(widgetId)
      success('Widget asignado')
    }
    widgetsAsignados.value = new Set(widgetsAsignados.value)
  } catch (e) {
    error('No se pudo actualizar la asignación')
  }
}
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto">
    <h1 class="text-lg font-semibold mb-6">Dashboards por usuario</h1>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>

    <template v-else>
      <select
        :value="usuarioSeleccionado"
        class="w-full border rounded px-2 py-1.5 text-sm mb-6"
        @change="seleccionarUsuario(($event.target as HTMLSelectElement).value)"
      >
        <option value="">Selecciona un usuario</option>
        <option v-for="u in usuarios" :key="u.id" :value="u.id">{{ u.full_name || u.email }}</option>
      </select>

      <div v-if="usuarioSeleccionado" class="space-y-4">
        <div v-for="tipo in ['kpi', 'chart']" :key="tipo">
          <h2 class="text-xs font-semibold text-gray-400 uppercase mb-2">
            {{ tipo === 'kpi' ? 'KPIs' : 'Gráficos' }}
          </h2>
          <ul class="space-y-1">
            <li
              v-for="w in catalogo.filter((c) => c.tipo === tipo)"
              :key="w.id"
              class="flex items-center justify-between text-sm border rounded px-3 py-2"
            >
              <div>
                <span class="font-medium">{{ w.label }}</span>
                <span v-if="w.descripcion" class="text-gray-400 ml-2">{{ w.descripcion }}</span>
              </div>
              <button
                class="text-xs px-2 py-1 rounded"
                :class="widgetsAsignados.has(w.id) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                @click="toggleWidget(w.id)"
              >
                {{ widgetsAsignados.has(w.id) ? 'Activo' : 'Inactivo' }}
              </button>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>
