<script setup lang="ts">
import type { AuditoriaEntry, AuditoriaFiltros } from '~/composables/useAuditoria'
import type { Usuario } from '~/composables/useUsuarios'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'auditoria', actions: ['view_all'] },
})

const { fetchAuditoria } = useAuditoria()
const { fetchUsuarios } = useUsuarios()

const registros = ref<AuditoriaEntry[]>([])
const usuarios = ref<Usuario[]>([])
const cargando = ref(true)
const cargandoMas = ref(false)
const hasMore = ref(false)
const pagina = ref(0)
const expandido = ref<string | null>(null)

const filtroUsuario = ref('')
const filtroTabla = ref('')
const filtroAccion = ref<'' | 'insert' | 'update' | 'delete'>('')
const filtroDesde = ref('')
const filtroHasta = ref('')

const filtrosActivos = computed(
  () => !!(filtroUsuario.value || filtroTabla.value || filtroAccion.value || filtroDesde.value || filtroHasta.value)
)

function construirFiltros(): AuditoriaFiltros {
  return {
    usuarioId: filtroUsuario.value || undefined,
    tabla: filtroTabla.value || undefined,
    accion: filtroAccion.value || undefined,
    desde: filtroDesde.value || undefined,
    hasta: filtroHasta.value || undefined,
  }
}

async function cargarPrimeraPagina() {
  cargando.value = true
  pagina.value = 0
  const resultado = await fetchAuditoria(construirFiltros(), 0)
  registros.value = resultado.registros
  hasMore.value = resultado.hasMore
  cargando.value = false
}

async function cargarMas() {
  cargandoMas.value = true
  pagina.value += 1
  const resultado = await fetchAuditoria(construirFiltros(), pagina.value)
  registros.value = [...registros.value, ...resultado.registros]
  hasMore.value = resultado.hasMore
  cargandoMas.value = false
}

onMounted(async () => {
  usuarios.value = await fetchUsuarios()
  await cargarPrimeraPagina()
})

watch([filtroUsuario, filtroTabla, filtroAccion, filtroDesde, filtroHasta], cargarPrimeraPagina)

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

    <div class="flex flex-wrap gap-2 mb-4">
      <select v-model="filtroUsuario" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30">
        <option value="">Todos los usuarios</option>
        <option v-for="u in usuarios" :key="u.id" :value="u.id">{{ u.full_name || u.email }}</option>
      </select>

      <select v-model="filtroTabla" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30">
        <option value="">Todas las tablas</option>
        <option value="clientes">Clientes</option>
        <option value="leads">Leads</option>
        <option value="tickets">Tickets</option>
        <option value="productos">Productos</option>
      </select>

      <select v-model="filtroAccion" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30">
        <option value="">Todas las acciones</option>
        <option value="insert">Creó</option>
        <option value="update">Editó</option>
        <option value="delete">Eliminó</option>
      </select>

      <input
        v-model="filtroDesde"
        type="date"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        @click="abrirPicker"
      />
      <input
        v-model="filtroHasta"
        type="date"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        @click="abrirPicker"
      />
    </div>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>

    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="registros.length === 0" class="p-10 text-center text-gray-400">
        {{ filtrosActivos ? 'Sin resultados para estos filtros' : 'Sin actividad registrada todavía' }}
      </div>
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
            <span class="text-xs text-gray-400">{{ new Date(r.created_at).toLocaleString('es-CL', { hour12: false }) }}</span>
          </div>

          <template v-for="diff in expandido === r.id ? [calcularDiff(r.accion, r.datos_anteriores, r.datos_nuevos)] : []" :key="`${r.id}-diff`">
            <div class="mt-3 text-xs">
              <ul v-if="diff.length" class="divide-y divide-gray-50">
                <li
                  v-for="d in diff"
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
          </template>
        </li>
      </ul>

      <div v-if="hasMore" class="p-4 text-center border-t border-gray-50">
        <button
          :disabled="cargandoMas"
          class="text-sm text-[#1075B5] hover:underline font-medium disabled:opacity-50"
          @click="cargarMas"
        >
          {{ cargandoMas ? 'Cargando...' : 'Cargar más' }}
        </button>
      </div>
    </div>
  </div>
</template>
