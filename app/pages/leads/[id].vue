<script setup lang="ts">
import type { Lead } from '~/composables/useLeads'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'leads', actions: ['view', 'view_all'] },
})

const route = useRoute()
const router = useRouter()
const { getLead, updateLead, convertirACliente } = useLeads()
const { can } = usePermissions()
const { success, error } = useToast()

const lead = ref<Lead | null>(null)
const cargando = ref(true)
const guardando = ref(false)
const convirtiendo = ref(false)
const errorConversion = ref('')

const rutConversion = ref('')
const razonSocialConversion = ref('')

onMounted(async () => {
  lead.value = await getLead(route.params.id as string)
  razonSocialConversion.value = lead.value?.nombre ?? ''
  cargando.value = false
})

const onSubmit = async (payload: Record<string, unknown>) => {
  if (!lead.value) return
  guardando.value = true
  try {
    lead.value = await updateLead(lead.value.id, payload)
    success('Lead actualizado')
  } catch (e) {
    error('No se pudo guardar el cambio. Intenta de nuevo.')
  } finally {
    guardando.value = false
  }
}

const puedeConvertir = computed(
  () => can('leads', 'edit') && can('clientes', 'create') && lead.value && !lead.value.cliente_id
)

const onConvertir = async () => {
  if (!lead.value || !razonSocialConversion.value) return
  convirtiendo.value = true
  errorConversion.value = ''
  try {
    const clienteId = await convertirACliente(lead.value.id, rutConversion.value, razonSocialConversion.value)
    success('Lead convertido a cliente')
    await router.push(`/clientes/${clienteId}`)
  } catch (e: any) {
    errorConversion.value = e.message ?? 'Error al convertir el lead'
    error(errorConversion.value)
  } finally {
    convirtiendo.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-lg">
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <template v-else-if="lead">
      <SharedPageHeader :titulo="lead.nombre" volver-a="/leads">
        <template #accion>
          <SharedBadge :label="colorLead(lead.estado).label" :clases="colorLead(lead.estado).clases" />
        </template>
      </SharedPageHeader>

      <SharedCard>
        <LeadsLeadForm :model-value="lead" :cargando="guardando" @submit="onSubmit" />
      </SharedCard>

      <div v-if="lead.cliente_id" class="mt-6">
        <SharedCard>
          <p class="text-sm text-gray-600">
            Este lead ya fue convertido en cliente.
            <NuxtLink :to="`/clientes/${lead.cliente_id}`" class="text-[#1075B5] hover:underline font-medium">
              Ver cliente
            </NuxtLink>
          </p>
        </SharedCard>
      </div>

      <div v-else-if="puedeConvertir" class="mt-6">
        <SharedCard titulo="Convertir a cliente">
          <div class="space-y-3">
            <input
              v-model="razonSocialConversion"
              type="text"
              placeholder="Razón social"
              class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
            />
            <input
              v-model="rutConversion"
              type="text"
              placeholder="RUT (opcional)"
              class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
            />
            <button
              :disabled="convirtiendo || !razonSocialConversion"
              class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              @click="onConvertir"
            >
              {{ convirtiendo ? 'Convirtiendo...' : 'Convertir a cliente' }}
            </button>
            <p v-if="errorConversion" class="text-sm text-red-600">{{ errorConversion }}</p>
          </div>
        </SharedCard>
      </div>
      <div class="mt-6">
        <SharedTareaList entidad-tipo="lead" :entidad-id="lead.id" />
      </div>
      <div class="mt-6">
        <LeadsLeadTimeline :lead-id="lead.id" />
      </div>
    </template>
    <p v-else class="text-red-600">Lead no encontrado</p>
  </div>
  
</template>
