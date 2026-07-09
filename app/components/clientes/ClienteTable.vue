<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'

defineProps<{ clientes: Cliente[] }>()
defineEmits<{ eliminar: [cliente: Cliente] }>()
const { can } = usePermissions()
</script>

<template>
  <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <table class="w-full text-sm">
      <thead>
        <tr class="text-left border-b border-gray-100">
          <th class="py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Cliente</th>
          <th class="py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">RUT</th>
          <th class="py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Contacto</th>
          <th class="py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Teléfono</th>
          <th class="py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Email</th>
          <th class="py-3 px-4"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in clientes" :key="c.id" class="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
          <td class="py-3 px-4">
            <div class="flex items-center gap-3">
              <SharedAvatar :nombre="c.razon_social" size="sm" />
              <span class="font-medium text-gray-800">{{ c.razon_social }}</span>
            </div>
          </td>
          <td class="py-3 px-4 text-gray-500">{{ c.rut || '—' }}</td>
          <td class="py-3 px-4 text-gray-500">{{ c.nombre_contacto || '—' }}</td>
          <td class="py-3 px-4 text-gray-500">{{ c.telefono || '—' }}</td>
          <td class="py-3 px-4 text-gray-500">{{ c.email || '—' }}</td>
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end gap-3">
              <NuxtLink :to="`/clientes/${c.id}`" class="text-[#1075B5] hover:underline font-medium">
                {{ can('clientes', 'edit') ? 'Editar' : 'Ver' }}
              </NuxtLink>
              <button
                v-if="can('clientes', 'delete')"
                type="button"
                class="text-red-600 hover:underline font-medium"
                @click="$emit('eliminar', c)"
              >
                Eliminar
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="clientes.length === 0">
          <td colspan="6" class="py-10 text-center text-gray-400">Sin clientes todavía</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
