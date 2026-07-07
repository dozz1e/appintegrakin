<script setup lang="ts">
import type { Lead, EstadoLead } from '~/composables/useLeads'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'leads', actions: ['view', 'view_all'] },
})

const { fetchLeads, cambiarEstado } = useLeads()
const { can } = usePermissions()

const leads = ref<Lead[]>([])
const cargando = ref(true)

onMounted(async () => {
  leads.value = await fetchLeads()
  cargando.value = false
})

const onCambiarEstado = async (id: string, estado: EstadoLead) => {
  const actualizado = await cambiarEstado(id, estado)
  const idx = leads.value.findIndex((l) => l.id === id)
  if (idx !== -1) leads.value[idx] = actualizado
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Leads">
      <template #accion>
        <NuxtLink
          v-if="can('leads', 'create')"
          to="/leads/nuevo"
          class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Nuevo lead
        </NuxtLink>
      </template>
    </SharedPageHeader>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <LeadsLeadKanban v-else :leads="leads" @cambiar-estado="onCambiarEstado" />
  </div>
</template>
