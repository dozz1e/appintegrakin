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
import KpiLeadsActivos from '~/components/widgets/KpiLeadsActivos.vue'
import KpiTicketsAbiertos from '~/components/widgets/KpiTicketsAbiertos.vue'
import KpiTicketsAbiertosPostVenta from '~/components/widgets/KpiTicketsAbiertosPostVenta.vue'
import KpiTasaConversion from '~/components/widgets/KpiTasaConversion.vue'
import KpiTotalLeads from '~/components/widgets/KpiTotalLeads.vue'
import KpiLeadsGanados from '~/components/widgets/KpiLeadsGanados.vue'
import KpiLeadsPerdidos from '~/components/widgets/KpiLeadsPerdidos.vue'
import ChartFunnelLeads from '~/components/widgets/ChartFunnelLeads.vue'
import ChartPerformanceVendedores from '~/components/widgets/ChartPerformanceVendedores.vue'

const componentMap: Record<string, any> = {
  WidgetsKpiClientesTotales: KpiClientesTotales,
  WidgetsKpiLeadsActivos: KpiLeadsActivos,
  WidgetsKpiTicketsAbiertos: KpiTicketsAbiertos,
  WidgetsKpiTicketsAbiertosPostVenta: KpiTicketsAbiertosPostVenta,
  WidgetsKpiTasaConversion: KpiTasaConversion,
  WidgetsKpiTotalLeads: KpiTotalLeads,
  WidgetsKpiLeadsGanados: KpiLeadsGanados,
  WidgetsKpiLeadsPerdidos: KpiLeadsPerdidos,
  WidgetsChartFunnelLeads: ChartFunnelLeads,
  WidgetsChartPerformanceVendedores: ChartPerformanceVendedores,
}

const { misWidgets, cargarMisWidgets } = useDashboardWidgets()
const cargando = ref(true)

onMounted(async () => {
  await cargarMisWidgets()
  cargando.value = false
})

const widgetsVisibles = computed(() => misWidgets.value)
const kpisVisibles = computed(() => widgetsVisibles.value.filter((w) => w.tipo === 'kpi'))
const chartsVisibles = computed(() => widgetsVisibles.value.filter((w) => w.tipo === 'chart'))
</script>

<template>
  <div class="p-6">
    <h1 class="text-xl font-semibold mb-6">Tu dashboard</h1>

    <p v-if="cargando" class="text-gray-400">Cargando...</p>

    <p v-else-if="widgetsVisibles.length === 0" class="text-gray-400 text-sm">
      Todavía no tienes ningún widget asignado. Pídele a tu administrador que te active
      alguno desde el panel de dashboards.
    </p>

    <p v-else-if="widgetsVisibles.some((w) => !componentMap[w.component])" class="text-red-500 text-sm">
      Un widget asignado no tiene componente registrado en el mapa (revisa la consola).
    </p>

    <template v-else>
      <div
        v-if="kpisVisibles.length"
        class="grid gap-4 mb-6"
        :style="{ gridTemplateColumns: `repeat(${Math.min(kpisVisibles.length, 7)}, minmax(0, 1fr))` }"
      >
        <component
          :is="componentMap[w.component]"
          v-for="w in kpisVisibles"
          :key="w.key"
          v-bind="w.config"
        />
      </div>

      <div v-if="chartsVisibles.length" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <component
          :is="componentMap[w.component]"
          v-for="w in chartsVisibles"
          :key="w.key"
          v-bind="w.config"
        />
      </div>
    </template>
  </div>
</template>
