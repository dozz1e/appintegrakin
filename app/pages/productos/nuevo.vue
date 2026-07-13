<script setup lang="ts">
definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'productos', actions: ['create'] },
})

const { createProducto } = useProductos()
const router = useRouter()
const { success, error } = useToast()
const cargando = ref(false)

const onSubmit = async (payload: Record<string, unknown>) => {
  cargando.value = true
  try {
    const producto = await createProducto(payload)
    success('Producto creado correctamente')
    await router.push(`/productos/${producto.id}`)
  } catch (e: any) {
    if (e.code === '23505') {
      error('Ya existe un producto con ese SKU.')
    } else {
      error('No se pudo crear el producto. Intenta de nuevo.')
    }
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-lg">
    <SharedPageHeader titulo="Nuevo producto" volver-a="/productos" />
    <SharedCard>
      <ProductosProductoForm :cargando="cargando" @submit="onSubmit" />
    </SharedCard>
  </div>
</template>
