<script setup lang="ts">
definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'leads', actions: ['create'] },
})

const { createLead } = useLeads()
const router = useRouter()
const { success, error } = useToast()
const cargando = ref(false)

const onSubmit = async (payload: Record<string, unknown>) => {
  cargando.value = true
  try {
    const lead = await createLead(payload)
    success('Lead creado correctamente')
    await router.push(`/leads/${lead.id}`)
  } catch (e) {
    error('No se pudo crear el lead. Intenta de nuevo.')
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-lg">
    <SharedPageHeader titulo="Nuevo lead" volver-a="/leads" />
    <SharedCard>
      <LeadsLeadForm :cargando="cargando" @submit="onSubmit" />
    </SharedCard>
  </div>
</template>
