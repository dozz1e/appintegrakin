<script setup lang="ts">
definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'clientes', actions: ['create'] },
})

const { createCliente } = useClientes()
const router = useRouter()
const { success, error } = useToast()
const cargando = ref(false)

const onSubmit = async (payload: Record<string, unknown>) => {
  cargando.value = true
  try {
    const cliente = await createCliente(payload)
    success('Cliente creado correctamente')
    await router.push(`/clientes/${cliente.id}`)
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
