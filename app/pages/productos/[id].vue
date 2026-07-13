<script setup lang="ts">
import type { Producto } from '~/composables/useProductos'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'productos', actions: ['view', 'view_all'] },
})

const route = useRoute()
const { getProducto, updateProducto, deleteProducto } = useProductos()
const { can } = usePermissions()
const { success, error } = useToast()

const producto = ref<Producto | null>(null)
const cargando = ref(true)
const guardando = ref(false)
const confirmandoEliminar = ref(false)
const eliminando = ref(false)

onMounted(async () => {
  producto.value = await getProducto(route.params.id as string)
  cargando.value = false
})

const onSubmit = async (payload: Record<string, unknown>) => {
  if (!producto.value) return
  guardando.value = true
  try {
    producto.value = await updateProducto(producto.value.id, payload, producto.value.version)
    success('Producto actualizado')
  } catch (e: any) {
    if (e.code === '23505') {
      error('Ya existe un producto con ese SKU.')
    } else if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este producto mientras lo tenías abierto. Se recargaron los datos actuales, revisa e intenta de nuevo.')
      producto.value = await getProducto(route.params.id as string)
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  } finally {
    guardando.value = false
  }
}

async function onConfirmarEliminar() {
  if (!producto.value) return
  eliminando.value = true
  try {
    await deleteProducto(producto.value.id)
    success('Producto eliminado')
    await navigateTo('/productos')
  } catch (e) {
    error('No se pudo eliminar el producto. Intenta de nuevo.')
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-lg">
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <template v-else-if="producto">
      <SharedPageHeader :titulo="producto.nombre" volver-a="/productos" />

      <SharedCard>
        <ProductosProductoForm
          :model-value="producto"
          :cargando="guardando"
          mostrar-estado
          @submit="(payload) => (can('productos', 'edit') ? onSubmit(payload) : undefined)"
        />
      </SharedCard>

      <div v-if="can('productos', 'delete')" class="mt-6">
        <SharedCard>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold text-gray-700">Eliminar producto</h2>
              <p class="text-xs text-gray-400 mt-1">Esta acción no se puede deshacer.</p>
            </div>
            <button
              type="button"
              class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              @click="confirmandoEliminar = true"
            >
              Eliminar producto
            </button>
          </div>
        </SharedCard>
      </div>

      <SharedConfirmDialog
        :open="confirmandoEliminar"
        titulo="Eliminar producto"
        :mensaje="`¿Eliminar ${producto.nombre}? Esta acción no se puede deshacer.`"
        :cargando="eliminando"
        @confirmar="onConfirmarEliminar"
        @cancelar="confirmandoEliminar = false"
      />
    </template>
    <p v-else class="text-red-600">Producto no encontrado</p>
  </div>
</template>
