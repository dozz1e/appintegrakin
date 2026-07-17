<script setup lang="ts">
import type { Producto } from '~/composables/useProductos'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'productos', actions: ['view', 'view_all'] },
})

const { fetchProductos, importProductos, createProducto, updateProducto, deleteProducto } = useProductos()
const { can } = usePermissions()
const { parsearCSV, descargarCSV } = useCsv()
const { success, error } = useToast()

const productos = ref<Producto[]>([])
const cargando = ref(true)
const importando = ref(false)
const inputArchivo = ref<HTMLInputElement | null>(null)

const busqueda = ref('')
const filtroCategoria = ref('')
const filtroEstado = ref<'' | 'activo' | 'inactivo'>('')

const modalEditarAbierto = ref(false)
const productoEditando = ref<Producto | null>(null)
const guardandoEdicion = ref(false)
const confirmandoEliminar = ref(false)
const eliminando = ref(false)
const modalNuevoAbierto = ref(false)
const creando = ref(false)

function abrirEditar(p: Producto) {
  productoEditando.value = p
  modalEditarAbierto.value = true
}

async function onSubmitNuevo(payload: Record<string, unknown>) {
  creando.value = true
  try {
    const producto = await createProducto(payload)
    productos.value.push(producto)
    success('Producto creado correctamente')
    modalNuevoAbierto.value = false
  } catch (e: any) {
    if (e.code === '23505') {
      error('Ya existe un producto con ese SKU.')
    } else {
      error('No se pudo crear el producto. Intenta de nuevo.')
    }
  } finally {
    creando.value = false
  }
}

async function onSubmitEdicion(payload: Record<string, unknown>) {
  if (!productoEditando.value) return
  guardandoEdicion.value = true
  try {
    const actualizado = await updateProducto(productoEditando.value.id, payload, productoEditando.value.version)
    const idx = productos.value.findIndex((p) => p.id === actualizado.id)
    if (idx !== -1) productos.value[idx] = actualizado
    productoEditando.value = actualizado
    success('Producto actualizado')
    modalEditarAbierto.value = false
  } catch (e: any) {
    if (e.code === '23505') {
      error('Ya existe un producto con ese SKU.')
    } else if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este producto mientras lo tenías abierto. Vuelve a abrirlo para ver los datos actuales.')
      modalEditarAbierto.value = false
      productos.value = await fetchProductos()
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  } finally {
    guardandoEdicion.value = false
  }
}

async function onConfirmarEliminar() {
  if (!productoEditando.value) return
  eliminando.value = true
  try {
    await deleteProducto(productoEditando.value.id)
    productos.value = productos.value.filter((p) => p.id !== productoEditando.value?.id)
    success('Producto eliminado')
    confirmandoEliminar.value = false
    modalEditarAbierto.value = false
  } catch (e) {
    error('No se pudo eliminar el producto. Intenta de nuevo.')
  } finally {
    eliminando.value = false
  }
}

onMounted(async () => {
  productos.value = await fetchProductos()
  cargando.value = false
})

const categorias = computed(() =>
  [...new Set(productos.value.map((p) => p.categoria).filter((c): c is string => !!c))].sort()
)

const productosFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  return productos.value.filter((p) => {
    if (q && !p.nombre.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false
    if (filtroCategoria.value && p.categoria !== filtroCategoria.value) return false
    if (filtroEstado.value && p.estado !== filtroEstado.value) return false
    return true
  })
})

const colorEstado: Record<string, string> = {
  activo: 'bg-green-50 text-green-700',
  inactivo: 'bg-gray-100 text-gray-500',
}

function onExportar() {
  const filas = productos.value.map((p) => ({
    nombre: p.nombre,
    sku: p.sku,
    categoria: p.categoria ?? '',
    estado: p.estado,
  }))
  descargarCSV('productos', filas)
}

async function onArchivoSeleccionado(e: Event) {
  const archivo = (e.target as HTMLInputElement).files?.[0]
  if (!archivo) return

  importando.value = true
  try {
    const filas = await parsearCSV(archivo)
    const { insertados, omitidos } = await importProductos(filas)
    success(`${insertados} productos importados${omitidos ? `, ${omitidos} omitidos (duplicados o incompletos)` : ''}`)
    productos.value = await fetchProductos()
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
    <SharedPageHeader titulo="Productos">
      <template #accion>
        <div class="flex items-center gap-2">
          <button
            class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            @click="onExportar"
          >
            Exportar CSV
          </button>
          <button
            v-if="can('productos', 'create')"
            :disabled="importando"
            class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            @click="inputArchivo?.click()"
          >
            {{ importando ? 'Importando...' : 'Importar CSV' }}
          </button>
          <input ref="inputArchivo" type="file" accept=".csv" class="hidden" @change="onArchivoSeleccionado" />
          <button
            v-if="can('productos', 'create')"
            type="button"
            class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            @click="modalNuevoAbierto = true"
          >
            + Nuevo producto
          </button>
        </div>
      </template>
    </SharedPageHeader>

    <div class="flex flex-wrap gap-2 mb-4">
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por nombre o SKU..."
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
      <select v-model="filtroCategoria" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30">
        <option value="">Todas las categorías</option>
        <option v-for="c in categorias" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="filtroEstado" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30">
        <option value="">Todos los estados</option>
        <option value="activo">Activo</option>
        <option value="inactivo">Inactivo</option>
      </select>
    </div>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="productosFiltrados.length === 0" class="p-10 text-center text-gray-400">
        {{ busqueda || filtroCategoria || filtroEstado ? 'Sin resultados para estos filtros' : 'Sin productos todavía' }}
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Nombre</th>
            <th class="px-4 py-3 font-medium">SKU</th>
            <th class="px-4 py-3 font-medium">Categoría</th>
            <th class="px-4 py-3 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr
            v-for="p in productosFiltrados"
            :key="p.id"
            class="cursor-pointer hover:bg-gray-50"
            @click="abrirEditar(p)"
          >
            <td class="px-4 py-3 text-gray-700 font-medium">{{ p.nombre }}</td>
            <td class="px-4 py-3 text-gray-500">{{ p.sku }}</td>
            <td class="px-4 py-3 text-gray-500">{{ p.categoria || '—' }}</td>
            <td class="px-4 py-3">
              <SharedBadge :label="p.estado === 'activo' ? 'Activo' : 'Inactivo'" :clases="colorEstado[p.estado]" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <SharedModal
      :open="modalEditarAbierto"
      :titulo="productoEditando?.nombre ?? 'Editar producto'"
      @cerrar="modalEditarAbierto = false"
    >
      <ProductosProductoForm
        :model-value="productoEditando ?? undefined"
        :cargando="guardandoEdicion"
        mostrar-estado
        @submit="(payload) => (can('productos', 'edit') ? onSubmitEdicion(payload) : undefined)"
      />

      <div v-if="can('productos', 'delete')" class="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
        <div>
          <h2 class="text-sm font-semibold text-gray-700">Eliminar producto</h2>
          <p class="text-xs text-gray-400 mt-1">Esta acción no se puede deshacer.</p>
        </div>
        <button
          type="button"
          class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          @click="confirmandoEliminar = true"
        >
          Eliminar
        </button>
      </div>
    </SharedModal>

    <SharedConfirmDialog
      :open="confirmandoEliminar"
      titulo="Eliminar producto"
      :mensaje="`¿Eliminar ${productoEditando?.nombre}? Esta acción no se puede deshacer.`"
      :cargando="eliminando"
      @confirmar="onConfirmarEliminar"
      @cancelar="confirmandoEliminar = false"
    />

    <SharedModal :open="modalNuevoAbierto" titulo="Nuevo producto" @cerrar="modalNuevoAbierto = false">
      <ProductosProductoForm :cargando="creando" @submit="onSubmitNuevo" />
    </SharedModal>
  </div>
</template>
