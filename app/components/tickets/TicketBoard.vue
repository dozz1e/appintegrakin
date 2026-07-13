<script setup lang="ts">
import draggable from 'vuedraggable'
import type { Ticket, EstadoTicket } from '~/composables/useTickets'

const props = defineProps<{ tickets: Ticket[] }>()
const emit = defineEmits<{ 'cambiar-estado': [id: string, estado: EstadoTicket] }>()

const columnas: { estado: EstadoTicket; titulo: string }[] = [
  { estado: 'abierto', titulo: 'Abierto' },
  { estado: 'en_proceso', titulo: 'En proceso' },
  { estado: 'esperando_cliente', titulo: 'Esperando cliente' },
  { estado: 'resuelto', titulo: 'Resuelto' },
  { estado: 'cerrado', titulo: 'Cerrado' },
]

// draggable necesita mutar arrays directamente, por eso pasamos de
// un computed de solo lectura a un ref sincronizado con las props
const grupos = ref<Record<string, Ticket[]>>({})

function reconstruir() {
  const g: Record<string, Ticket[]> = {}
  for (const col of columnas) g[col.estado] = []
  for (const t of props.tickets) g[t.estado]?.push(t)
  grupos.value = g
}

watch(() => props.tickets, reconstruir, { immediate: true, deep: true })

function onDragChange(evt: any, estadoDestino: EstadoTicket) {
  if (evt.added) {
    const ticket = evt.added.element as Ticket
    emit('cambiar-estado', ticket.id, estadoDestino)
  }
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="grid grid-cols-5 gap-3 overflow-x-auto">
    <div
      v-for="col in columnas"
      :key="col.estado"
      class="min-w-[190px] rounded-lg p-3"
      :class="colorTicket(col.estado).clases.split(' ')[0]"
    >
      <h3
        class="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center justify-between"
        :class="colorTicket(col.estado).clases.split(' ')[1]"
      >
        {{ col.titulo }}
        <span class="opacity-60">{{ grupos[col.estado]?.length ?? 0 }}</span>
      </h3>

      <draggable
        v-model="grupos[col.estado]"
        group="tickets"
        item-key="id"
        class="space-y-2 min-h-[80px]"
        @change="(evt) => onDragChange(evt, col.estado)"
      >
        <template #item="{ element: ticket }">
          <div class="border border-gray-100 rounded-xl p-3 bg-white shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between gap-2 mb-2">
              <NuxtLink :to="`/tickets/${ticket.id}`" class="font-medium text-sm text-gray-800 hover:underline">
                {{ ticket.titulo }}
              </NuxtLink>
              <SharedBadge :label="colorPrioridad(ticket.prioridad).label" :clases="colorPrioridad(ticket.prioridad).clases" />
            </div>
            <p class="text-xs text-gray-400">{{ ticket.clientes?.razon_social ?? 'Cliente no disponible' }}</p>
            <p class="text-[11px] text-gray-300 mt-0.5">{{ formatearFecha(ticket.created_at) }}</p>
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>