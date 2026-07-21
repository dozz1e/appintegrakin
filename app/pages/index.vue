<!-- app/pages/index.vue -->
<script setup lang="ts">
// Home = dashboard personal. Cada usuario ve exactamente los widgets que
// le asignó la dueña o el superadmin (tabla user_dashboard_widgets) -
// la asignación ya no depende de que el usuario tenga además permiso de
// view/view_all sobre el resource del widget (antes sí, pedido explícito
// para poder darle cualquier dashboard a cualquier usuario). Si se le
// revoca el permiso de un módulo después de asignarle un widget de ese
// módulo, el widget sigue visible hasta que se desasigna a mano desde
// /admin/dashboards.
//
// El componente se resuelve con un mapa explícito, NO con <component :is="string">
// dependiendo del registro global de Nuxt (por defecto Nuxt NO registra los
// componentes globalmente, solo los importa cuando se usan como etiqueta fija
// en un template - eso rompe la resolución dinámica por string sin avisar).
//
// Al agregar un widget nuevo: import + agregar la línea en componentMap. Sí,
// es un paso manual extra, pero es explícito y no depende de configuración
// oculta de Nuxt que ya nos mordió una vez.

import KpiClientesTotales from '~/components/widgets/KpiClientesTotales.vue'
import KpiTotalLeads from '~/components/widgets/KpiTotalLeads.vue'
import KpiTasaConversion from '~/components/widgets/KpiTasaConversion.vue'
import KpiLeadsGanados from '~/components/widgets/KpiLeadsGanados.vue'
import ChartLeadsTendencia from '~/components/widgets/ChartLeadsTendencia.vue'
import ChartLeadsPorEstado from '~/components/widgets/ChartLeadsPorEstado.vue'
import TablaLeadManagement from '~/components/widgets/TablaLeadManagement.vue'
import ChartPerformanceVendedores from '~/components/widgets/ChartPerformanceVendedores.vue'
import ChartClientesTendencia from '~/components/widgets/ChartClientesTendencia.vue'
import KpiTicketsPostVentaTotal from '~/components/widgets/KpiTicketsPostVentaTotal.vue'
import KpiTicketsPostVentaDespachados from '~/components/widgets/KpiTicketsPostVentaDespachados.vue'
import KpiTicketsPostVentaVencidos from '~/components/widgets/KpiTicketsPostVentaVencidos.vue'
import KpiTicketsPostVentaEnProceso from '~/components/widgets/KpiTicketsPostVentaEnProceso.vue'
import ChartTicketsPostVentaTendencia from '~/components/widgets/ChartTicketsPostVentaTendencia.vue'
import ChartTicketsPostVentaPorEstado from '~/components/widgets/ChartTicketsPostVentaPorEstado.vue'
import TablaPostVentaManagement from '~/components/widgets/TablaPostVentaManagement.vue'

const componentMap: Record<string, any> = {
  WidgetsKpiClientesTotales: KpiClientesTotales,
  WidgetsKpiTotalLeads: KpiTotalLeads,
  WidgetsKpiTasaConversion: KpiTasaConversion,
  WidgetsKpiLeadsGanados: KpiLeadsGanados,
  WidgetsChartLeadsTendencia: ChartLeadsTendencia,
  WidgetsChartLeadsPorEstado: ChartLeadsPorEstado,
  WidgetsTablaLeadManagement: TablaLeadManagement,
  WidgetsChartPerformanceVendedores: ChartPerformanceVendedores,
  WidgetsChartClientesTendencia: ChartClientesTendencia,
  WidgetsKpiTicketsPostVentaTotal: KpiTicketsPostVentaTotal,
  WidgetsKpiTicketsPostVentaDespachados: KpiTicketsPostVentaDespachados,
  WidgetsKpiTicketsPostVentaVencidos: KpiTicketsPostVentaVencidos,
  WidgetsKpiTicketsPostVentaEnProceso: KpiTicketsPostVentaEnProceso,
  WidgetsChartTicketsPostVentaTendencia: ChartTicketsPostVentaTendencia,
  WidgetsChartTicketsPostVentaPorEstado: ChartTicketsPostVentaPorEstado,
  WidgetsTablaPostVentaManagement: TablaPostVentaManagement,
}

import draggable from 'vuedraggable'
import type { MiWidget } from '~/composables/useDashboardWidgets'

const { misWidgets, cargarMisWidgets, reordenarMisWidgets, setVisibilidadMiWidget } = useDashboardWidgets()
const { error: toastError } = useToast()
const cargando = ref(true)
const modoEdicion = ref(false)

onMounted(async () => {
  await cargarMisWidgets()
  cargando.value = false
})

// draggable necesita mutar arrays directamente (mismo motivo que
// LeadKanban.vue) - se sincronizan con misWidgets vía watch.
const kpis = ref<MiWidget[]>([])
const charts = ref<MiWidget[]>([])
const tablas = ref<MiWidget[]>([])
const kpisOcultos = ref<MiWidget[]>([])
const chartsOcultos = ref<MiWidget[]>([])
const tablasOcultos = ref<MiWidget[]>([])

function reconstruir() {
  kpis.value = misWidgets.value.filter((w) => w.tipo === 'kpi' && w.visible)
  charts.value = misWidgets.value.filter((w) => w.tipo === 'chart' && w.visible)
  tablas.value = misWidgets.value.filter((w) => w.tipo === 'tabla' && w.visible)
  kpisOcultos.value = misWidgets.value.filter((w) => w.tipo === 'kpi' && !w.visible)
  chartsOcultos.value = misWidgets.value.filter((w) => w.tipo === 'chart' && !w.visible)
  tablasOcultos.value = misWidgets.value.filter((w) => w.tipo === 'tabla' && !w.visible)
}

watch(misWidgets, reconstruir, { deep: true })

async function guardarOrden(lista: MiWidget[]) {
  const previo = misWidgets.value.map((w) => ({ ...w }))
  try {
    await reordenarMisWidgets(lista.map((w, i) => ({ widgetId: w.widget_id, orden: i })))
  } catch {
    misWidgets.value = previo
    toastError('No se pudo guardar el nuevo orden')
  }
}

async function ocultar(widget: MiWidget) {
  const previo = misWidgets.value.map((w) => ({ ...w }))
  try {
    await setVisibilidadMiWidget(widget.widget_id, false)
    const w = misWidgets.value.find((x) => x.widget_id === widget.widget_id)
    if (w) w.visible = false
  } catch {
    misWidgets.value = previo
    toastError('No se pudo ocultar el widget')
  }
}

async function reactivar(widget: MiWidget) {
  const previo = misWidgets.value.map((w) => ({ ...w }))
  try {
    await setVisibilidadMiWidget(widget.widget_id, true)
    const w = misWidgets.value.find((x) => x.widget_id === widget.widget_id)
    if (w) w.visible = true
  } catch {
    misWidgets.value = previo
    toastError('No se pudo reactivar el widget')
  }
}

const widgetsVisibles = computed(() => [...kpis.value, ...charts.value, ...tablas.value])
const kpisVisibles = kpis
const chartsVisibles = charts
const tablasVisibles = tablas
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-semibold">Tu dashboard</h1>
      <button
        v-if="!cargando && widgetsVisibles.length + kpisOcultos.length + chartsOcultos.length + tablasOcultos.length > 0"
        type="button"
        class="text-sm font-medium border rounded-lg px-3 py-1.5 transition-colors"
        :class="modoEdicion
          ? 'bg-primary text-ink-onprimary border-primary'
          : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'"
        @click="modoEdicion = !modoEdicion"
      >
        {{ modoEdicion ? 'Listo' : 'Editar dashboard' }}
      </button>
    </div>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>

    <p
      v-else-if="widgetsVisibles.length === 0 && kpisOcultos.length === 0 && chartsOcultos.length === 0 && tablasOcultos.length === 0"
      class="text-gray-400 text-sm"
    >
      Todavía no tienes ningún widget asignado. Pídele a tu administrador que te active
      alguno desde el panel de dashboards.
    </p>

    <p v-else-if="widgetsVisibles.some((w) => !componentMap[w.component])" class="text-red-500 text-sm">
      Un widget asignado no tiene componente registrado en el mapa (revisa la consola).
    </p>

    <template v-else>
      <draggable
        v-if="kpisVisibles.length"
        v-model="kpis"
        :disabled="!modoEdicion"
        item-key="widget_id"
        tag="div"
        class="grid grid-cols-2 sm:grid-cols-3 lg:[grid-template-columns:var(--kpi-cols)] gap-4 mb-6"
        :style="{ '--kpi-cols': `repeat(${Math.min(kpisVisibles.length, 8)}, minmax(0, 1fr))` }"
        @end="guardarOrden(kpis)"
      >
        <template #item="{ element: w }">
          <div class="relative" :class="modoEdicion ? 'cursor-grab active:cursor-grabbing' : ''">
            <button
              v-if="modoEdicion"
              type="button"
              title="Ocultar"
              class="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-gray-700 text-white flex items-center justify-center hover:bg-danger transition-colors"
              @click="ocultar(w)"
            >
              <Icon name="mdi:close" class="w-3.5 h-3.5" />
            </button>
            <component :is="componentMap[w.component]" v-bind="w.config" />
          </div>
        </template>
      </draggable>

      <draggable
        v-if="chartsVisibles.length"
        v-model="charts"
        :disabled="!modoEdicion"
        item-key="widget_id"
        tag="div"
        class="grid grid-cols-1 lg:grid-cols-4 gap-4"
        @end="guardarOrden(charts)"
      >
        <template #item="{ element: w }">
          <div
            class="relative"
            :class="[
              modoEdicion ? 'cursor-grab active:cursor-grabbing' : '',
              ['WidgetsChartLeadsTendencia', 'WidgetsChartTicketsPostVentaTendencia', 'WidgetsChartClientesTendencia'].includes(w.component) ? 'lg:col-span-3' : '',
            ]"
          >
            <button
              v-if="modoEdicion"
              type="button"
              title="Ocultar"
              class="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-gray-700 text-white flex items-center justify-center hover:bg-danger transition-colors"
              @click="ocultar(w)"
            >
              <Icon name="mdi:close" class="w-3.5 h-3.5" />
            </button>
            <component :is="componentMap[w.component]" v-bind="w.config" />
          </div>
        </template>
      </draggable>

      <draggable
        v-if="tablasVisibles.length"
        v-model="tablas"
        :disabled="!modoEdicion"
        item-key="widget_id"
        tag="div"
        class="grid grid-cols-1 gap-4 mt-4"
        @end="guardarOrden(tablas)"
      >
        <template #item="{ element: w }">
          <div class="relative" :class="modoEdicion ? 'cursor-grab active:cursor-grabbing' : ''">
            <button
              v-if="modoEdicion"
              type="button"
              title="Ocultar"
              class="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-gray-700 text-white flex items-center justify-center hover:bg-danger transition-colors"
              @click="ocultar(w)"
            >
              <Icon name="mdi:close" class="w-3.5 h-3.5" />
            </button>
            <component :is="componentMap[w.component]" v-bind="w.config" />
          </div>
        </template>
      </draggable>

      <div
        v-if="modoEdicion && (kpisOcultos.length || chartsOcultos.length || tablasOcultos.length)"
        class="mt-8 pt-4 border-t border-gray-100"
      >
        <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Widgets ocultos</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="w in [...kpisOcultos, ...chartsOcultos, ...tablasOcultos]"
            :key="w.widget_id"
            type="button"
            class="flex items-center gap-1.5 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg px-3 py-1.5 opacity-60 hover:opacity-100 hover:border-primary hover:text-primary transition-all"
            @click="reactivar(w)"
          >
            <Icon name="mdi:plus" class="w-3.5 h-3.5" />
            {{ w.label }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
