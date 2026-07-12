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

          <div v-if="expandido === r.id" class="mt-3 text-xs">
            <ul v-if="calcularDiff(r.accion, r.datos_anteriores, r.datos_nuevos).length" class="divide-y divide-gray-50">
              <li
                v-for="d in calcularDiff(r.accion, r.datos_anteriores, r.datos_nuevos)"
                :key="d.campo"
                class="py-1.5 flex items-center gap-2"
              >
                <span class="font-medium text-gray-600 w-40 flex-shrink-0">{{ d.etiqueta }}</span>
                <template v-if="r.accion === 'update'">
                  <span class="text-gray-400">{{ d.anterior }}</span>
                  <Icon name="mdi:arrow-right" class="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  <span class="text-gray-700">{{ d.nuevo }}</span>
                </template>
                <span v-else class="text-gray-700">{{ d.valor }}</span>
              </li>
            </ul>
            <p v-else class="text-gray-400">Sin cambios visibles en los campos</p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
