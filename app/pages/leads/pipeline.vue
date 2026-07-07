<template>
  <div>
    <PageHeader titulo="Pipeline de Leads" />
    <div class="flex gap-4 overflow-x-auto pb-4">
      <div
        v-for="estadoKey in estados"
        :key="estadoKey"
        class="flex-shrink-0 w-72 rounded-lg p-3"
        :class="colorLead(estadoKey).clases.split(' ')[0]"
      >
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-semibold" :class="colorLead(estadoKey).clases.split(' ')[1]">
            {{ colorLead(estadoKey).label }}
          </span>
          <span class="text-xs opacity-60">{{ leads[estadoKey].length }}</span>
        </div>

        <draggable
          v-model="leads[estadoKey]"
          group="leads"
          item-key="id"
          class="min-h-[200px] space-y-2"
          @change="(evt) => onDragChange(evt, estadoKey)"
        >
          <template #item="{ element }">
            <div class="bg-white rounded shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
              <p class="font-medium text-sm">{{ element.nombre }}</p>
              <p class="text-xs text-gray-500">{{ element.origen }}</p>
              <Badge :texto="element.telefono" />
            </div>
          </template>
        </draggable>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'

const estados = ['nuevo', 'contactado', 'cotizado', 'negociacion', 'ganado', 'perdido']
const { leads, cargarLeads, moverLead } = useLeadsPipeline()

onMounted(cargarLeads)

async function onDragChange(evt: any, estadoDestino: string) {
  if (evt.added) {
    const lead = evt.added.element
    await moverLead(lead.id, estadoDestino)
  }
}
</script>