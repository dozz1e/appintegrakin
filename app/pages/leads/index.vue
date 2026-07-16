<script setup lang="ts">
import type { Lead, EstadoLead } from '~/composables/useLeads'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'leads', actions: ['view', 'view_all'] },
})

const { fetchLeads, cambiarEstado, importLeads } = useLeads()
const { can } = usePermissions()
const { parsearCSV, descargarCSV } = useCsv()
const { success, error } = useToast()

const leads = ref<Lead[]>([])
const cargando = ref(true)
const importando = ref(false)
const inputArchivo = ref<HTMLInputElement | null>(null)
const busqueda = ref('')

onMounted(async () => {
  leads.value = await fetchLeads()
  cargando.value = false
})

const leadsFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return leads.value
  return leads.value.filter((l) => l.nombre.toLowerCase().includes(q))
})

const onCambiarEstado = async (id: string, estado: EstadoLead) => {
  const actualizado = await cambiarEstado(id, estado)
  const idx = leads.value.findIndex((l) => l.id === id)
  if (idx !== -1) leads.value[idx] = actualizado
}

function onExportar() {
  const filas = leads.value.map((l) => ({
    nombre: l.nombre,
    telefono: l.telefono ?? '',
    email: l.email ?? '',
    origen: l.origen ?? '',
    estado: l.estado,
  }))
  descargarCSV('leads', filas)
}

async function onArchivoSeleccionado(e: Event) {
  const archivo = (e.target as HTMLInputElement).files?.[0]
  if (!archivo) return

  importando.value = true
  try {
    const filas = await parsearCSV(archivo)
    const { insertados, omitidos } = await importLeads(filas)
    success(`${insertados} leads importados${omitidos ? `, ${omitidos} omitidos (duplicados o incompletos)` : ''}`)
    leads.value = await fetchLeads()
  } catch (e) {
    error('No se pudo importar el archivo. Revisa el formato del CSV.')
  } finally {
    importando.value = false
    if (inputArchivo.value) inputArchivo.value.value = ''
  }
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Leads">
      <template #accion>
        <div class="flex items-center gap-2">
          <button
            class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            @click="onExportar"
          >
            Exportar CSV
          </button>
          <button
            v-if="can('leads', 'create')"
            :disabled="importando"
            class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            @click="inputArchivo?.click()"
          >
            {{ importando ? 'Importando...' : 'Importar CSV' }}
          </button>
          <input ref="inputArchivo" type="file" accept=".csv" class="hidden" @change="onArchivoSeleccionado" />
          <NuxtLink
            v-if="can('leads', 'create')"
            to="/leads/nuevo"
            class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Nuevo lead
          </NuxtLink>
        </div>
      </template>
    </SharedPageHeader>

    <div class="flex flex-wrap gap-2 mb-4">
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por nombre..."
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
    </div>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <LeadsLeadKanban v-else :leads="leadsFiltrados" @cambiar-estado="onCambiarEstado" />
  </div>
</template>
