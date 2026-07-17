<script setup lang="ts">
import type { ResultadoBusqueda } from '~/composables/useBusquedaGlobal'

const { buscar } = useBusquedaGlobal()
const router = useRouter()

const termino = ref('')
const resultados = ref<ResultadoBusqueda>({ clientes: [], leads: [], tickets: [] })
const cargando = ref(false)
const abierto = ref(false)
const contenedor = ref<HTMLElement | null>(null)

let debounceHandle: ReturnType<typeof setTimeout> | null = null

const hayResultados = computed(
  () => resultados.value.clientes.length > 0 || resultados.value.leads.length > 0 || resultados.value.tickets.length > 0
)

watch(termino, (nuevo) => {
  if (debounceHandle) clearTimeout(debounceHandle)

  if (nuevo.trim().length < 2) {
    resultados.value = { clientes: [], leads: [], tickets: [] }
    abierto.value = nuevo.trim().length > 0 // muestra "sigue escribiendo..." si hay 1 caracter
    return
  }

  cargando.value = true
  abierto.value = true
  debounceHandle = setTimeout(async () => {
    try {
      resultados.value = await buscar(nuevo)
    } catch {
      resultados.value = { clientes: [], leads: [], tickets: [] }
    } finally {
      cargando.value = false
    }
  }, 300)
})

function irA(path: string) {
  abierto.value = false
  termino.value = ''
  router.push(path)
}

function onClickFuera(e: MouseEvent) {
  if (contenedor.value && !contenedor.value.contains(e.target as Node)) {
    abierto.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickFuera))
onUnmounted(() => document.removeEventListener('click', onClickFuera))
</script>

<template>
  <div ref="contenedor" class="relative w-full">
    <div class="relative">
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm">🔍</span>
      <input
        v-model="termino"
        type="text"
        placeholder="Buscar clientes, leads, tickets..."
        class="w-full bg-surface-2 border border-border rounded-full pl-9 pr-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-ring transition-colors duration-150"
        @focus="abierto = termino.trim().length > 0"
      />
    </div>

    <div
      v-if="abierto"
      class="absolute mt-2 w-full max-w-md bg-surface border border-border rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto"
    >
      <p v-if="termino.trim().length < 2" class="text-xs text-ink-muted px-4 py-3">
        Escribe al menos 2 caracteres...
      </p>

      <p v-else-if="cargando" class="text-xs text-ink-muted px-4 py-3">Buscando...</p>

      <p v-else-if="!hayResultados" class="text-xs text-ink-muted px-4 py-3">
        Sin resultados para "{{ termino }}"
      </p>

      <template v-else>
        <div v-if="resultados.clientes.length" class="py-2">
          <p class="px-4 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Clientes</p>
          <button
            v-for="c in resultados.clientes"
            :key="c.id"
            class="w-full text-left px-4 py-2 hover:bg-surface-2 transition-colors duration-150 flex flex-col"
            @click="irA(`/clientes?cliente_id=${c.id}`)"
          >
            <span class="text-sm font-medium text-ink">{{ c.razon_social }}</span>
            <span class="text-xs text-ink-muted">{{ c.nombre_contacto || c.email || c.telefono || '' }}</span>
          </button>
        </div>

        <div v-if="resultados.leads.length" class="py-2 border-t border-border">
          <p class="px-4 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Leads</p>
          <button
            v-for="l in resultados.leads"
            :key="l.id"
            class="w-full text-left px-4 py-2 hover:bg-surface-2 transition-colors duration-150 flex items-center justify-between gap-2"
            @click="irA(`/leads/${l.id}`)"
          >
            <div class="flex flex-col">
              <span class="text-sm font-medium text-ink">{{ l.nombre }}</span>
              <span class="text-xs text-ink-muted">{{ l.telefono || l.email || '' }}</span>
            </div>
            <SharedBadge :label="colorLead(l.estado).label" :clases="colorLead(l.estado).clases" />
          </button>
        </div>

        <div v-if="resultados.tickets.length" class="py-2 border-t border-border">
          <p class="px-4 text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Tickets</p>
          <button
            v-for="t in resultados.tickets"
            :key="t.id"
            class="w-full text-left px-4 py-2 hover:bg-surface-2 transition-colors duration-150 flex items-center justify-between gap-2"
            @click="irA(`/tickets/${t.id}`)"
          >
            <span class="text-sm font-medium text-ink truncate">{{ t.titulo }}</span>
            <SharedBadge :label="colorTicket(t.estado).label" :clases="colorTicket(t.estado).clases" />
          </button>
        </div>
      </template>
    </div>
  </div>
</template>