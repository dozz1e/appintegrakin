<script setup lang="ts">
import type { Feature } from '~/composables/useFeatures'
import type { Usuario } from '~/composables/useUsuarios'

definePageMeta({ middleware: 'superadmin' })

const { fetchTodasLasFeatures, crearFeature, fetchFeaturesDeUsuario, otorgarFeature, quitarFeature } =
  useFeatures()
const { fetchUsuarios } = useUsuarios()
const { success, error } = useToast()
const { fetchErrores } = useErrorLog()

const errores = ref<Awaited<ReturnType<typeof fetchErrores>>>([])

const features = ref<Feature[]>([])
const usuarios = ref<Usuario[]>([])
const usuarioSeleccionado = ref<string>('')
const featuresDelUsuario = ref<Set<string>>(new Set()) // feature_id activas para ese usuario
const cargando = ref(true)

const nuevaKey = ref('')
const nuevaLabel = ref('')
const nuevaDescripcion = ref('')

const cargarTodo = async () => {
  cargando.value = true
  features.value = await fetchTodasLasFeatures()
  usuarios.value = await fetchUsuarios()
  errores.value = await fetchErrores()
  cargando.value = false
}

onMounted(cargarTodo)

const seleccionarUsuario = async (userId: string) => {
  usuarioSeleccionado.value = userId
  if (!userId) {
    featuresDelUsuario.value = new Set()
    return
  }
  const rows = await fetchFeaturesDeUsuario(userId)
  featuresDelUsuario.value = new Set(rows.filter((r: any) => r.enabled).map((r: any) => r.feature_id))
}

const toggleFeature = async (featureId: string) => {
  if (!usuarioSeleccionado.value) return
  try {
    if (featuresDelUsuario.value.has(featureId)) {
      await quitarFeature(usuarioSeleccionado.value, featureId)
      featuresDelUsuario.value.delete(featureId)
    } else {
      await otorgarFeature(usuarioSeleccionado.value, featureId)
      featuresDelUsuario.value.add(featureId)
    }
    featuresDelUsuario.value = new Set(featuresDelUsuario.value)
  } catch (e) {
    error('No se pudo actualizar la feature')
  }
}

const onCrearFeature = async () => {
  if (!nuevaKey.value || !nuevaLabel.value) return
  try {
    await crearFeature({ key: nuevaKey.value, label: nuevaLabel.value, description: nuevaDescripcion.value })
    nuevaKey.value = ''
    nuevaLabel.value = ''
    nuevaDescripcion.value = ''
    features.value = await fetchTodasLasFeatures()
    success('Feature creada')
  } catch (e) {
    error('No se pudo crear la feature (¿la key ya existe?)')
  }
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <h1 class="text-lg font-semibold mb-1">Panel dev</h1>
    <p class="text-xs text-gray-400 mb-6">Solo vos ves esta página. No aparece en ningún menú.</p>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>

    <template v-else>
      <!-- Crear feature nueva -->
      <div class="border rounded p-4 mb-8">
        <h2 class="text-sm font-semibold mb-3">Nueva feature</h2>
        <div class="grid grid-cols-3 gap-2 mb-2">
          <input v-model="nuevaKey" placeholder="key (ej. dashboard.reporte_x)" class="border rounded px-2 py-1 text-sm" />
          <input v-model="nuevaLabel" placeholder="label" class="border rounded px-2 py-1 text-sm" />
          <input v-model="nuevaDescripcion" placeholder="descripción (opcional)" class="border rounded px-2 py-1 text-sm" />
        </div>
        <button class="bg-black text-white px-3 py-1.5 rounded text-sm" @click="onCrearFeature">
          Crear
        </button>
      </div>

      <!-- Asignar features a un usuario -->
      <div class="border rounded p-4">
        <h2 class="text-sm font-semibold mb-3">Asignar a usuario</h2>
        <select
          :value="usuarioSeleccionado"
          class="w-full border rounded px-2 py-1.5 text-sm mb-4"
          @change="seleccionarUsuario(($event.target as HTMLSelectElement).value)"
        >
          <option value="">Selecciona un usuario</option>
          <option v-for="u in usuarios" :key="u.id" :value="u.id">{{ u.full_name || u.email }}</option>
        </select>

        <ul v-if="usuarioSeleccionado" class="space-y-2">
          <li v-for="f in features" :key="f.id" class="flex items-center justify-between text-sm">
            <div>
              <span class="font-medium">{{ f.label }}</span>
              <span class="text-gray-400 ml-2">{{ f.key }}</span>
            </div>
            <button
              class="text-xs px-2 py-1 rounded"
              :class="featuresDelUsuario.has(f.id) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
              @click="toggleFeature(f.id)"
            >
              {{ featuresDelUsuario.has(f.id) ? 'Activa' : 'Inactiva' }}
            </button>
          </li>
        </ul>
      </div>
      <!-- Log de errores -->
      <div class="border rounded p-4 mt-8">
        <h2 class="text-sm font-semibold mb-3">Errores recientes (últimos {{ errores.length }})</h2>
        <p v-if="errores.length === 0" class="text-sm text-gray-400">Sin errores registrados</p>
        <ul v-else class="space-y-2 text-xs max-h-96 overflow-y-auto">
          <li v-for="e in errores" :key="e.id" class="border-b border-gray-100 pb-2">
            <div class="flex items-center justify-between">
              <span class="text-red-600 font-medium">{{ e.mensaje }}</span>
              <span class="text-gray-400">{{ new Date(e.created_at).toLocaleString('es-CL') }}</span>
            </div>
            <p class="text-gray-400">{{ e.ruta || '—' }}</p>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
