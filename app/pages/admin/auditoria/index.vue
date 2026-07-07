<script setup lang="ts">
import type { AuditoriaEntry } from '~/composables/useAuditoria'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'auditoria', actions: ['view_all'] },
})

const { fetchAuditoria } = useAuditoria()
const registros = ref<AuditoriaEntry[]>([])
const cargando = ref(true)
const expandido = ref<string | null>(null)

onMounted(async () => {
  registros.value = await fetchAuditoria()
  cargando.value = false
})

const colorAccion: Record<string, string> = {
  insert: 'bg-green-50 text-green-700',
  update: 'bg-[#EAF4FA] text-[#0C5D91]',
  delete: 'bg-red-50 text-red-700',
}

const labelAccion: Record<string, string> = {
  insert: 'Creó',
  update: 'Editó',
  delete: 'Eliminó',
}

const toggle = (id: string) => {
  expandido.value = expandido.value === id ? null : id
}
</script>

<template>
  <div class="p-6">
    <SharedPageHeader titulo="Auditoría" />

    <p v-if="cargando" class="text-gray-400">Cargando...</p>

    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="registros.length === 0" class="p-10 text-center text-gray-400">Sin actividad registrada todavía</div>
      <ul v-else class="divide-y divide-gray-50">
        <li v-for="r in registros" :key="r.id" class="p-4">
          <div class="flex items-center justify-between cursor-pointer" @click="toggle(r.id)">
            <div class="flex items-center gap-3">
              <SharedBadge :label="labelAccion[r.accion]" :clases="colorAccion[r.accion]" />
              <span class="text-sm text-gray-700">
                <span class="font-medium">{{ r.usuario?.full_name || r.usuario?.email || 'Sistema' }}</span>
                en <span class="text-gray-500">{{ r.tabla }}</span>
              </span>
            </div>
            <span class="text-xs text-gray-400">{{ new Date(r.created_at).toLocaleString('es-CL') }}</span>
          </div>

          <div v-if="expandido === r.id" class="mt-3 grid grid-cols-2 gap-4 text-xs">
            <div v-if="r.datos_anteriores">
              <p class="font-semibold text-gray-400 mb-1">Antes</p>
              <pre class="bg-gray-50 rounded-lg p-2 overflow-x-auto text-gray-600">{{ JSON.stringify(r.datos_anteriores, null, 2) }}</pre>
            </div>
            <div v-if="r.datos_nuevos">
              <p class="font-semibold text-gray-400 mb-1">Después</p>
              <pre class="bg-gray-50 rounded-lg p-2 overflow-x-auto text-gray-600">{{ JSON.stringify(r.datos_nuevos, null, 2) }}</pre>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
