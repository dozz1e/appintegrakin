<script setup lang="ts">
import type { Producto } from '~/composables/useProductos'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'productos', actions: ['view', 'view_all'] },
})

const { fetchProductos, importProductos } = useProductos()
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
    unidad_medida: p.unidad_medida ?? '',
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
          <NuxtLink
            v-if="can('productos', 'create')"
            to="/productos/nuevo"
            class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Nuevo producto
          </NuxtLink>
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
            <th class="px-4 py-3 font-medium">Unidad</th>
            <th class="px-4 py-3 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr
            v-for="p in productosFiltrados"
            :key="p.id"
            class="cursor-pointer hover:bg-gray-50"
            @click="navigateTo(`/productos/${p.id}`)"
          >
            <td class="px-4 py-3 text-gray-700 font-medium">{{ p.nombre }}</td>
            <td class="px-4 py-3 text-gray-500">{{ p.sku }}</td>
            <td class="px-4 py-3 text-gray-500">{{ p.categoria || '—' }}</td>
            <td class="px-4 py-3 text-gray-500">{{ p.unidad_medida || '—' }}</td>
            <td class="px-4 py-3">
              <SharedBadge :label="p.estado === 'activo' ? 'Activo' : 'Inactivo'" :clases="colorEstado[p.estado]" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
