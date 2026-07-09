<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'clientes', actions: ['view', 'view_all'] },
})

const { fetchClientes, importClientes, deleteCliente } = useClientes()
const { can } = usePermissions()
const { parsearCSV, descargarCSV } = useCsv()
const { success, error } = useToast()

const clientes = ref<Cliente[]>([])
const cargando = ref(true)
const importando = ref(false)
const inputArchivo = ref<HTMLInputElement | null>(null)
const clienteAEliminar = ref<Cliente | null>(null)
const eliminando = ref(false)

onMounted(async () => {
  clientes.value = await fetchClientes()
  cargando.value = false
})

function onExportar() {
  const filas = clientes.value.map((c) => ({
    rut: c.rut ?? '',
    razon_social: c.razon_social,
    nombre_contacto: c.nombre_contacto ?? '',
    telefono: c.telefono ?? '',
    email: c.email ?? '',
  }))
  descargarCSV('clientes', filas)
}

async function onArchivoSeleccionado(e: Event) {
  const archivo = (e.target as HTMLInputElement).files?.[0]
  if (!archivo) return

  importando.value = true
  try {
    const filas = await parsearCSV(archivo)
    const { insertados, omitidos } = await importClientes(filas)
    success(`${insertados} clientes importados${omitidos ? `, ${omitidos} omitidos (duplicados o incompletos)` : ''}`)
    clientes.value = await fetchClientes()
  } catch (e) {
    error('No se pudo importar el archivo. Revisa el formato del CSV.')
  } finally {
    importando.value = false
    if (inputArchivo.value) inputArchivo.value.value = ''
  }
}

async function onConfirmarEliminar() {
  if (!clienteAEliminar.value) return
  eliminando.value = true
  try {
    await deleteCliente(clienteAEliminar.value.id)
    clientes.value = clientes.value.filter((c) => c.id !== clienteAEliminar.value!.id)
    success('Cliente eliminado')
  } catch (e: any) {
    if (e.code === '23503') {
      error('No se puede eliminar: el cliente tiene leads o tickets asociados. Resuélvelos primero.')
    } else {
      error('No se pudo eliminar el cliente. Intenta de nuevo.')
    }
  } finally {
    eliminando.value = false
    clienteAEliminar.value = null
  }
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Clientes">
      <template #accion>
        <div class="flex items-center gap-2">
          <button
            class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            @click="onExportar"
          >
            Exportar CSV
          </button>
          <button
            v-if="can('clientes', 'create')"
            :disabled="importando"
            class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            @click="inputArchivo?.click()"
          >
            {{ importando ? 'Importando...' : 'Importar CSV' }}
          </button>
          <input ref="inputArchivo" type="file" accept=".csv" class="hidden" @change="onArchivoSeleccionado" />
          <NuxtLink
            v-if="can('clientes', 'create')"
            to="/clientes/nuevo"
            class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Nuevo cliente
          </NuxtLink>
        </div>
      </template>
    </SharedPageHeader>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <ClientesClienteTable v-else :clientes="clientes" @eliminar="clienteAEliminar = $event" />

    <SharedConfirmDialog
      :open="!!clienteAEliminar"
      titulo="Eliminar cliente"
      :mensaje="`¿Eliminar a ${clienteAEliminar?.razon_social}? Esta acción no se puede deshacer.`"
      :cargando="eliminando"
      @confirmar="onConfirmarEliminar"
      @cancelar="clienteAEliminar = null"
    />
  </div>
</template>
