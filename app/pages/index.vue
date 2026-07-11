<!-- app/pages/index.vue -->
<script setup lang="ts">
// Home = dashboard personal. Cada usuario ve solo los widgets que le
// asignó la dueña o el superadmin (tabla user_dashboard_widgets) Y que
// además puede ver según sus permisos actuales (si se le asignó un widget
// y luego se le revocó el acceso a esa página, el widget deja de mostrarse
// sin que haya que ir a desasignarlo a mano).
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
import ChartLeadsPorEstado from '~/components/widgets/ChartLeadsPorEstado.vue'
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
  WidgetsChartLeadsPorEstado: ChartLeadsPorEstado,
  WidgetsKpiTasaConversion: KpiTasaConversion,
  WidgetsKpiTotalLeads: KpiTotalLeads,
  WidgetsKpiLeadsGanados: KpiLeadsGanados,
  WidgetsKpiLeadsPerdidos: KpiLeadsPerdidos,
  WidgetsChartFunnelLeads: ChartFunnelLeads,
  WidgetsChartPerformanceVendedores: ChartPerformanceVendedores,
}

const { misWidgets, cargarMisWidgets } = useDashboardWidgets()
const { can } = usePermissions()
const cargando = ref(true)

onMounted(async () => {
  await cargarMisWidgets()
  cargando.value = false
})

const widgetsVisibles = computed(() => misWidgets.value.filter((w) => can(w.resource, 'view') || can(w.resource, 'view_all')))
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

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <component
        :is="componentMap[w.component]"
        v-for="w in widgetsVisibles"
        :key="w.key"
        v-bind="w.config"
      />
    </div>
  </div>
</template>
