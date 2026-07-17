<script setup lang="ts">
definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'clientes', actions: ['create'] },
})

const { createCliente, updateCliente, subirImagenCliente } = useClientes()
const router = useRouter()
const { success, error } = useToast()
const cargando = ref(false)

const onSubmit = async (payload: Record<string, unknown>, archivoImagen?: File | null) => {
  cargando.value = true
  try {
    const cliente = await createCliente(payload)
    success('Cliente creado correctamente')

    if (archivoImagen) {
      try {
        const imagen_url = await subirImagenCliente(cliente.id, archivoImagen)
        await updateCliente(cliente.id, { imagen_url })
      } catch (e) {
        error('Cliente creado, pero no se pudo subir la imagen. Puedes intentarlo de nuevo editando el cliente.')
      }
    }

    await router.push('/clientes')
  } catch (e) {
    error('No se pudo crear el cliente. Intenta de nuevo.')
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-lg">
    <SharedPageHeader titulo="Nuevo cliente" volver-a="/clientes" />
    <SharedCard>
      <ClientesClienteForm :cargando="cargando" @submit="onSubmit" />
    </SharedCard>
  </div>
</template>
