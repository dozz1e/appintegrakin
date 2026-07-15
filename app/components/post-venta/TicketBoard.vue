<!-- app/components/post-venta/TicketBoard.vue -->
<script setup lang="ts">
import draggable from 'vuedraggable'
import type { TicketPostVentaConNombres, EstadoTicketPostVenta } from '~/composables/useTicketsPostVenta'

const props = defineProps<{ tickets: TicketPostVentaConNombres[] }>()
const emit = defineEmits<{ 'cambiar-estado': [id: string, estado: EstadoTicketPostVenta] }>()

const columnas: { estado: EstadoTicketPostVenta; titulo: string }[] = [
  { estado: 'pendiente_ingreso', titulo: 'Pendiente de ingreso' },
  { estado: 'ingreso_equipo', titulo: 'Ingreso de equipo' },
  { estado: 'probando', titulo: 'Probando' },
  { estado: 'espera_repuesto', titulo: 'Espera de repuesto' },
  { estado: 'listo_despacho', titulo: 'Listo para despacho' },
  { estado: 'despachado', titulo: 'Despachado' },
  { estado: 'desconocido', titulo: 'Desconocido' },
]

// draggable necesita mutar arrays directamente, por eso pasamos de un
// computed de solo lectura a un ref sincronizado con las props (mismo
// patrón que tickets/TicketBoard.vue)
const grupos = ref<Record<string, TicketPostVentaConNombres[]>>({})

function reconstruir() {
  const g: Record<string, TicketPostVentaConNombres[]> = {}
  for (const col of columnas) g[col.estado] = []
  for (const t of props.tickets) g[t.estado]?.push(t)
  grupos.value = g
}

watch(() => props.tickets, reconstruir, { immediate: true, deep: true })

function onDragChange(evt: any, estadoDestino: EstadoTicketPostVenta) {
  if (evt.added) {
    const ticket = evt.added.element as TicketPostVentaConNombres
    emit('cambiar-estado', ticket.id, estadoDestino)
  }
}

function esVencido(ticket: TicketPostVentaConNombres): boolean {
  return !!ticket.fecha_tope && ticket.estado !== 'despachado' && ticket.fecha_tope < new Date().toISOString().slice(0, 10)
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <div class="grid grid-cols-7 gap-3 overflow-x-auto">
    <div
      v-for="col in columnas"
      :key="col.estado"
      class="min-w-[190px] rounded-lg p-3"
      :class="colorTicketPostVenta(col.estado).clases.split(' ')[0]"
    >
      <h3
        class="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center justify-between"
        :class="colorTicketPostVenta(col.estado).clases.split(' ')[1]"
      >
        {{ col.titulo }}
        <span class="opacity-60">{{ grupos[col.estado]?.length ?? 0 }}</span>
      </h3>

      <draggable
        v-model="grupos[col.estado]"
        group="tickets-post-venta"
        item-key="id"
        class="space-y-2 min-h-[80px]"
        @change="(evt) => onDragChange(evt, col.estado)"
      >
        <template #item="{ element: ticket }">
          <div class="border border-gray-100 rounded-xl p-3 bg-white shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between gap-2 mb-2">
              <NuxtLink :to="`/post-venta/${ticket.id}`" class="font-medium text-sm text-gray-800 hover:underline">
                {{ ticket.n_guia }}
              </NuxtLink>
              <span v-if="esVencido(ticket)" class="text-xs text-red-600 font-medium">vencido</span>
            </div>
            <p class="text-xs text-gray-400">{{ ticket.cliente_nombre }}</p>
            <p class="text-[11px] text-gray-500 mt-0.5">{{ ticket.producto_nombre }}</p>
            <p v-if="ticket.fecha_tope" class="text-[11px] mt-0.5" :class="esVencido(ticket) ? 'text-red-600 font-medium' : 'text-gray-400'">
              Tope: {{ formatearFecha(ticket.fecha_tope) }}
            </p>
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>
