<script setup lang="ts">
import type { Lead } from '~/composables/useLeads'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'leads', actions: ['view', 'view_all'] },
})

const route = useRoute()
const router = useRouter()
const { getLead, updateLead, deleteLead, convertirACliente } = useLeads()
const { can } = usePermissions()
const { success, error } = useToast()

const lead = ref<Lead | null>(null)
const cargando = ref(true)
const guardando = ref(false)
const convirtiendo = ref(false)
const errorConversion = ref('')
const confirmandoEliminar = ref(false)
const eliminando = ref(false)

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
    lead.value = await updateLead(lead.value.id, payload, lead.value.version)
    success('Lead actualizado')
  } catch (e: any) {
    if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este lead mientras lo tenías abierto. Se recargaron los datos actuales, revisa e intenta de nuevo.')
      lead.value = await getLead(route.params.id as string)
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
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

async function onConfirmarEliminar() {
  if (!lead.value) return
  eliminando.value = true
  try {
    await deleteLead(lead.value.id)
    success('Lead eliminado')
    await router.push('/leads')
  } catch (e) {
    error('No se pudo eliminar el lead. Intenta de nuevo.')
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="p-6">
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <template v-else-if="lead">
      <SharedPageHeader :titulo="lead.nombre" volver-a="/leads">
        <template #subtitulo>Creado el {{ formatearFecha(lead.created_at) }}</template>
        <template #accion>
          <SharedBadge :label="colorLead(lead.estado).label" :clases="colorLead(lead.estado).clases" />
        </template>
      </SharedPageHeader>

      <div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr] gap-6 items-start">
        <div class="space-y-6">
          <SharedCard>
            <LeadsLeadForm :model-value="lead" :cargando="guardando" @submit="onSubmit" />
          </SharedCard>

          <SharedCard v-if="lead.cliente_id">
            <p class="text-sm text-gray-600">
              Este lead ya fue convertido en cliente.
              <NuxtLink :to="`/clientes/${lead.cliente_id}`" class="text-[#1075B5] hover:underline font-medium">
                Ver cliente
              </NuxtLink>
            </p>
          </SharedCard>

          <SharedCard v-else-if="puedeConvertir" titulo="Convertir a cliente">
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

          <SharedCard v-if="can('leads', 'delete')">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-sm font-semibold text-gray-700">Eliminar lead</h2>
                <p class="text-xs text-gray-400 mt-1">Esta acción no se puede deshacer.</p>
              </div>
              <button
                type="button"
                class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                @click="confirmandoEliminar = true"
              >
                Eliminar lead
              </button>
            </div>
          </SharedCard>
        </div>

        <LeadsLeadTimeline :lead-id="lead.id" />

        <SharedTareaList entidad-tipo="lead" :entidad-id="lead.id" />
      </div>

      <SharedConfirmDialog
        :open="confirmandoEliminar"
        titulo="Eliminar lead"
        :mensaje="`¿Eliminar a ${lead.nombre}? Esta acción no se puede deshacer.`"
        :cargando="eliminando"
        @confirmar="onConfirmarEliminar"
        @cancelar="confirmandoEliminar = false"
      />
    </template>
    <p v-else class="text-red-600">Lead no encontrado</p>
  </div>
</template>
