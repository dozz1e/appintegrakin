<template>
  <div>
    <PageHeader titulo="Pipeline de Tickets" />
    <div class="flex gap-4 overflow-x-auto pb-4">
      <div
        v-for="estadoKey in estados"
        :key="estadoKey"
        class="flex-shrink-0 w-72 rounded-lg p-3"
        :class="colorTicket(estadoKey).clases.split(' ')[0]"
      >
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-semibold" :class="colorTicket(estadoKey).clases.split(' ')[1]">
            {{ colorTicket(estadoKey).label }}
          </span>
          <span class="text-xs opacity-60">{{ tickets[estadoKey].length }}</span>
        </div>

        <draggable
          v-model="tickets[estadoKey]"
          group="tickets"
          item-key="id"
          class="min-h-[200px] space-y-2"
          @change="(evt) => onDragChange(evt, estadoKey)"
        >
          <template #item="{ element }">
            <div class="bg-white rounded shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
              <p class="font-medium text-sm">{{ element.titulo }}</p>
              <p class="text-xs text-gray-500">{{ element.cliente?.razon_social }}</p>
              <span class="text-xs" :class="colorPrioridad(element.prioridad).clases">
                {{ colorPrioridad(element.prioridad).label }}
              </span>
            </div>
          </template>
        </draggable>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'

const estados = ['abierto', 'en_proceso', 'esperando_cliente', 'resuelto', 'cerrado']
const { tickets, cargarTickets, moverTicket } = useTicketsPipeline()

onMounted(cargarTickets)

async function onDragChange(evt: any, estadoDestino: string) {
  if (evt.added) {
    const ticket = evt.added.element
    await moverTicket(ticket.id, estadoDestino)
  }
}
</script>