<script setup lang="ts">
import type { EstadoLead } from '~/composables/useLeads'

const { fetchLeads } = useLeads()
const cargando = ref(true)

const estados: EstadoLead[] = ['nuevo', 'contactado', 'cotizado', 'negociacion', 'ganado', 'perdido']
const conteos = ref<Record<string, number>>({})

onMounted(async () => {
  const leads = await fetchLeads()
  const acc: Record<string, number> = {}
  for (const e of estados) acc[e] = 0
  for (const l of leads) acc[l.estado] = (acc[l.estado] ?? 0) + 1
  conteos.value = acc
  cargando.value = false
})

const maximo = computed(() => Math.max(1, ...Object.values(conteos.value)))
</script>

<template>
  <div class="border rounded-lg p-4">
    <p class="text-xs text-gray-500 mb-3">Leads por estado</p>
    <p v-if="cargando" class="text-gray-400 text-sm">Cargando...</p>
    <div v-else class="space-y-2">
      <div v-for="e in estados" :key="e" class="flex items-center gap-2 text-xs">
        <span class="w-24 text-gray-500 capitalize">{{ e }}</span>
        <div class="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
          <div
            class="bg-blue-500 h-4 rounded"
            :style="{ width: `${(conteos[e] / maximo) * 100}%` }"
          />
        </div>
        <span class="w-6 text-right text-gray-600">{{ conteos[e] }}</span>
      </div>
    </div>
  </div>
</template>
