<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'
import type { Usuario } from '~/composables/useUsuarios'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'clientes', actions: ['view', 'view_all'] },
})

const { fetchClientes, importClientes, deleteCliente, createCliente, updateCliente, subirImagenCliente } = useClientes()
const { fetchUsuariosPorRol } = useUsuarios()
const { can } = usePermissions()
const { parsearCSV, descargarCSV } = useCsv()
const { success, error } = useToast()
const route = useRoute()

const clientes = ref<Cliente[]>([])
const usuarios = ref<Usuario[]>([])
const cargando = ref(true)
const importando = ref(false)
const inputArchivo = ref<HTMLInputElement | null>(null)
const clienteAEliminar = ref<Cliente | null>(null)
const eliminando = ref(false)
const modalNuevoAbierto = ref(false)
const creando = ref(false)

async function onSubmitNuevo(payload: Record<string, unknown>, archivoImagen?: File | null) {
  creando.value = true
  try {
    let cliente = await createCliente(payload)
    if (archivoImagen) {
      try {
        const imagen_url = await subirImagenCliente(cliente.id, archivoImagen)
        cliente = await updateCliente(cliente.id, { imagen_url })
      } catch (e) {
        error('Cliente creado, pero no se pudo subir la imagen. Puedes intentarlo de nuevo editando el cliente.')
      }
    }
    clientes.value.push(cliente)
    success('Cliente creado correctamente')
    modalNuevoAbierto.value = false
  } catch (e) {
    error('No se pudo crear el cliente. Intenta de nuevo.')
  } finally {
    creando.value = false
  }
}

onMounted(async () => {
  clientes.value = await fetchClientes()
  usuarios.value = await fetchUsuariosPorRol('ventas')
  cargando.value = false
})

function onExportar() {
  const filas = clientes.value.map((c) => ({
    rut: c.rut ?? '',
    razon_social: c.razon_social,
    nombre_contacto: c.nombre_contacto ?? '',
    telefono: c.telefono ?? '',
    email: c.email ?? '',
    direccion: c.direccion ?? '',
    ciudad: c.ciudad ?? '',
    comuna: c.comuna ?? '',
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

function onActualizar(cliente: Cliente) {
  const idx = clientes.value.findIndex((c) => c.id === cliente.id)
  if (idx !== -1) clientes.value[idx] = cliente
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
          <button
            v-if="can('clientes', 'create')"
            type="button"
            class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            @click="modalNuevoAbierto = true"
          >
            + Nuevo cliente
          </button>
        </div>
      </template>
    </SharedPageHeader>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <ClientesClienteSplitView
      v-else
      :clientes="clientes"
      :usuarios="usuarios"
      :cliente-id-inicial="route.query.cliente_id as string | undefined"
      @eliminar="clienteAEliminar = $event"
      @actualizar="onActualizar"
    />

    <SharedConfirmDialog
      :open="!!clienteAEliminar"
      titulo="Eliminar cliente"
      :mensaje="`¿Eliminar a ${clienteAEliminar?.razon_social}? Esta acción no se puede deshacer.`"
      :cargando="eliminando"
      @confirmar="onConfirmarEliminar"
      @cancelar="clienteAEliminar = null"
    />

    <SharedModal :open="modalNuevoAbierto" titulo="Nuevo cliente" @cerrar="modalNuevoAbierto = false">
      <ClientesClienteForm :cargando="creando" @submit="onSubmitNuevo" />
    </SharedModal>
  </div>
</template>
