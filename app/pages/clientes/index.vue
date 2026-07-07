<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'clientes', actions: ['view', 'view_all'] },
})

const { fetchClientes } = useClientes()
const { can } = usePermissions()

const clientes = ref<Cliente[]>([])
const cargando = ref(true)

onMounted(async () => {
  clientes.value = await fetchClientes()
  cargando.value = false
})
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Clientes">
      <template #accion>
        <NuxtLink
          v-if="can('clientes', 'create')"
          to="/clientes/nuevo"
          class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Nuevo cliente
        </NuxtLink>
      </template>
    </SharedPageHeader>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <ClientesClienteTable v-else :clientes="clientes" />
  </div>
</template>
