# Eliminar leads y tickets desde la UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar la opción de eliminar un lead desde `/leads/[id]` y un ticket desde `/tickets/[id]`, reutilizando el permiso (`leads.delete`/`tickets.delete`), la política RLS y el componente `SharedConfirmDialog` ya existentes. A diferencia de clientes, no hay tabla de listado (Kanban) ni bloqueo por foreign key.

**Architecture:** Dos tareas simétricas e independientes, una por entidad. Cada una agrega una función de borrado al composable correspondiente (`deleteLead`/`deleteTicket`, mismo patrón que `deleteCliente`) y una tarjeta "Eliminar" en la página de detalle, gateada por permiso, con `SharedConfirmDialog`. Sin caso especial de foreign key en el catch — a diferencia de clientes, nada bloquea el borrado de un lead/ticket.

**Tech Stack:** Nuxt 4 / Vue 3 / Supabase (Postgres + RLS). Reutiliza `SharedConfirmDialog` (ya existe, de la feature "eliminar clientes").

## Global Constraints

- Componentes/páginas modificadas requieren `rm -rf .nuxt && npm run dev` para que Nuxt las tome — el hot-reload no alcanza.
- Nada de tests automatizados en este repo todavía — la verificación de cada tarea es que el dev server compile sin errores + un checklist manual de navegador para el usuario.
- Sin comentarios explicativos salvo que documenten un porqué no obvio.
- No se toca ninguna migración SQL ni política RLS — el backend (permiso, RLS) ya existe completo para ambas entidades.
- No se agrega limpieza de `tareas`/`notificaciones` huérfanas — decisión explícita del spec, quedan intactas tal como están hoy.
- `leads/[id].vue` ya usa `router.push(...)` (para la conversión a cliente) — la redirección tras eliminar debe usar `router.push('/leads')` para ser consistente con el resto del archivo, NO `navigateTo`.
- `tickets/[id].vue` no usa `router` en ningún lado — la redirección tras eliminar debe usar `navigateTo('/tickets')`, igual que en `clientes/[id].vue`.
- Mensajes de error: sin caso especial de `e.code` (a diferencia de clientes) — cualquier error muestra el mensaje genérico correspondiente a la entidad.

---

### Task 1: Eliminar lead desde el detalle (`/leads/[id]`)

**Files:**
- Modify: `app/composables/useLeads.ts`
- Modify: `app/pages/leads/[id].vue`

**Interfaces:**
- Consumes: `SharedConfirmDialog` (ya existe, props `open`/`titulo`/`mensaje`/`cargando`, emits `confirmar`/`cancelar`).
- Produces: `deleteLead(id: string): Promise<void>` en `useLeads.ts` — no consumida por ninguna otra tarea de este plan (Task 2 es independiente, sobre tickets).

- [ ] **Step 1: Agregar `deleteLead` a `useLeads.ts`**

Reemplazar el contenido completo de `app/composables/useLeads.ts`:

```ts
// composables/useLeads.ts

export type EstadoLead = 'nuevo' | 'contactado' | 'cotizado' | 'negociacion' | 'ganado' | 'perdido'

export interface Lead {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  origen: string | null
  estado: EstadoLead
  cliente_id: string | null
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
}

export const useLeads = () => {
  const supabase = useSupabaseClient()

  const fetchLeads = async (filtroEstado?: EstadoLead) => {
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (filtroEstado) query = query.eq('estado', filtroEstado)
    const { data, error } = await query
    if (error) throw error
    return data as Lead[]
  }

  const getLead = async (id: string) => {
    const { data, error } = await supabase.from('leads').select('*').eq('id', id).single()
    if (error) throw error
    return data as Lead
  }

  const createLead = async (payload: Partial<Lead>) => {
    const { data, error } = await supabase.from('leads').insert(payload).select().single()
    if (error) throw error
    return data as Lead
  }

  const updateLead = async (id: string, payload: Partial<Lead>, expectedVersion?: number) => {
    let query = supabase
      .from('leads')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (expectedVersion !== undefined) query = query.eq('version', expectedVersion)

    const { data, error } = await query.select().maybeSingle()
    if (error) throw error

    // si se pidió chequeo de versión y no volvió ninguna fila, alguien más
    // ya guardó cambios sobre este registro mientras estaba abierto
    if (expectedVersion !== undefined && !data) {
      throw new Error('CONFLICTO_VERSION')
    }
    return data as Lead
  }

  const deleteLead = async (id: string) => {
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) throw error
  }

  const cambiarEstado = (id: string, estado: EstadoLead) => updateLead(id, { estado })

  // requiere permiso leads.assign (se valida por RLS del lado servidor)
  const asignarLead = (id: string, ownerId: string) => updateLead(id, { owner_id: ownerId })

  const convertirACliente = async (leadId: string, rut: string, razonSocial: string) => {
    const { data, error } = await supabase.rpc('convertir_lead_a_cliente', {
      p_lead_id: leadId,
      p_rut: rut,
      p_razon_social: razonSocial,
    })
    if (error) throw error
    return data as string // id del cliente creado
  }

  // Importación masiva con deduplicación por teléfono/email. No hay unique
  // constraint en la tabla para estos campos, así que la dedupe se hace acá:
  // se trae lo que el usuario ya puede ver (RLS aplica solo) y se descartan
  // coincidencias antes del insert.
  const importLeads = async (filas: Record<string, string>[]) => {
    const user = useSupabaseUser()

    const { data: existentes, error: errorExistentes } = await supabase
      .from('leads')
      .select('telefono, email')
    if (errorExistentes) throw errorExistentes

    const telefonosExistentes = new Set((existentes ?? []).map((l) => l.telefono).filter(Boolean))
    const emailsExistentes = new Set((existentes ?? []).map((l) => l.email?.toLowerCase()).filter(Boolean))

    let omitidos = 0
    const candidatos = filas
      .filter((f) => f.nombre?.trim())
      .filter((f) => {
        const tel = f.telefono?.trim()
        const mail = f.email?.trim().toLowerCase()
        const esDuplicado = (tel && telefonosExistentes.has(tel)) || (mail && emailsExistentes.has(mail))
        if (esDuplicado) omitidos++
        return !esDuplicado
      })
      .map((f) => ({
        nombre: f.nombre.trim(),
        telefono: f.telefono?.trim() || null,
        email: f.email?.trim() || null,
        origen: f.origen?.trim() || 'importacion',
        estado: 'nuevo' as EstadoLead,
        owner_id: user.value?.sub,
        created_by: user.value?.sub,
      }))

    if (!candidatos.length) return { insertados: 0, omitidos: filas.length }

    const { data, error } = await supabase.from('leads').insert(candidatos).select()
    if (error) throw error

    return { insertados: data?.length ?? 0, omitidos }
  }

  return {
    fetchLeads,
    getLead,
    createLead,
    updateLead,
    deleteLead,
    cambiarEstado,
    asignarLead,
    convertirACliente,
    importLeads,
  }
}
```

- [ ] **Step 2: Agregar la tarjeta de eliminar en `leads/[id].vue`**

Reemplazar el contenido completo de `app/pages/leads/[id].vue`:

```vue
<script setup lang="ts">
import type { Lead } from '~/composables/useLeads'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'leads', actions: ['view', 'view_all'] },
})

const route = useRoute()
const router = useRouter()
const { getLead, updateLead, deleteLead, convertirACliente } = useLeads()
const { can } = usePermissions()
const { success, error } = useToast()

const lead = ref<Lead | null>(null)
const cargando = ref(true)
const guardando = ref(false)
const convirtiendo = ref(false)
const errorConversion = ref('')
const confirmandoEliminar = ref(false)
const eliminando = ref(false)

const rutConversion = ref('')
const razonSocialConversion = ref('')

onMounted(async () => {
  lead.value = await getLead(route.params.id as string)
  razonSocialConversion.value = lead.value?.nombre ?? ''
  cargando.value = false
})

const onSubmit = async (payload: Record<string, unknown>) => {
  if (!lead.value) return
  guardando.value = true
  try {
    lead.value = await updateLead(lead.value.id, payload, lead.value.version)
    success('Lead actualizado')
  } catch (e: any) {
    if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este lead mientras lo tenías abierto. Se recargaron los datos actuales, revisa e intenta de nuevo.')
      lead.value = await getLead(route.params.id as string)
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  } finally {
    guardando.value = false
  }
}

const puedeConvertir = computed(
  () => can('leads', 'edit') && can('clientes', 'create') && lead.value && !lead.value.cliente_id
)

const onConvertir = async () => {
  if (!lead.value || !razonSocialConversion.value) return
  convirtiendo.value = true
  errorConversion.value = ''
  try {
    const clienteId = await convertirACliente(lead.value.id, rutConversion.value, razonSocialConversion.value)
    success('Lead convertido a cliente')
    await router.push(`/clientes/${clienteId}`)
  } catch (e: any) {
    errorConversion.value = e.message ?? 'Error al convertir el lead'
    error(errorConversion.value)
  } finally {
    convirtiendo.value = false
  }
}

async function onConfirmarEliminar() {
  if (!lead.value) return
  eliminando.value = true
  try {
    await deleteLead(lead.value.id)
    success('Lead eliminado')
    await router.push('/leads')
  } catch (e) {
    error('No se pudo eliminar el lead. Intenta de nuevo.')
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-lg">
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <template v-else-if="lead">
      <SharedPageHeader :titulo="lead.nombre" volver-a="/leads">
        <template #accion>
          <SharedBadge :label="colorLead(lead.estado).label" :clases="colorLead(lead.estado).clases" />
        </template>
      </SharedPageHeader>

      <SharedCard>
        <LeadsLeadForm :model-value="lead" :cargando="guardando" @submit="onSubmit" />
      </SharedCard>

      <div v-if="lead.cliente_id" class="mt-6">
        <SharedCard>
          <p class="text-sm text-gray-600">
            Este lead ya fue convertido en cliente.
            <NuxtLink :to="`/clientes/${lead.cliente_id}`" class="text-[#1075B5] hover:underline font-medium">
              Ver cliente
            </NuxtLink>
          </p>
        </SharedCard>
      </div>

      <div v-else-if="puedeConvertir" class="mt-6">
        <SharedCard titulo="Convertir a cliente">
          <div class="space-y-3">
            <input
              v-model="razonSocialConversion"
              type="text"
              placeholder="Razón social"
              class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
            />
            <input
              v-model="rutConversion"
              type="text"
              placeholder="RUT (opcional)"
              class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
            />
            <button
              :disabled="convirtiendo || !razonSocialConversion"
              class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              @click="onConvertir"
            >
              {{ convirtiendo ? 'Convirtiendo...' : 'Convertir a cliente' }}
            </button>
            <p v-if="errorConversion" class="text-sm text-red-600">{{ errorConversion }}</p>
          </div>
        </SharedCard>
      </div>
      <div class="mt-6">
        <SharedTareaList entidad-tipo="lead" :entidad-id="lead.id" />
      </div>
      <div class="mt-6">
        <LeadsLeadTimeline :lead-id="lead.id" />
      </div>

      <div v-if="can('leads', 'delete')" class="mt-6">
        <SharedCard>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold text-gray-700">Eliminar lead</h2>
              <p class="text-xs text-gray-400 mt-1">Esta acción no se puede deshacer.</p>
            </div>
            <button
              type="button"
              class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              @click="confirmandoEliminar = true"
            >
              Eliminar lead
            </button>
          </div>
        </SharedCard>
      </div>

      <SharedConfirmDialog
        :open="confirmandoEliminar"
        titulo="Eliminar lead"
        :mensaje="`¿Eliminar a ${lead.nombre}? Esta acción no se puede deshacer.`"
        :cargando="eliminando"
        @confirmar="onConfirmarEliminar"
        @cancelar="confirmandoEliminar = false"
      />
    </template>
    <p v-else class="text-red-600">Lead no encontrado</p>
  </div>
</template>
```

- [ ] **Step 3: `rm -rf .nuxt` y levantar el dev server**

```bash
rm -rf .nuxt
npm run dev
```

- [ ] **Step 4: Checklist manual de navegador (para el usuario)**

1. Como usuario con `leads.delete`: entrar al detalle de un lead. Confirmar que aparece la tarjeta "Eliminar lead" con el botón rojo, debajo de tareas/timeline.
2. Click en "Eliminar lead", confirmar que aparece el modal. Click en "Cancelar": el modal se cierra, el lead sigue intacto.
3. Repetir y confirmar. Verificar que redirige a `/leads` con el toast "Lead eliminado" y que el Kanban ya no muestra ese lead.
4. Eliminar un lead que tenga interacciones registradas en su timeline (o crear una de prueba primero). Confirmar que el borrado funciona sin error.
5. Como usuario sin `leads.delete`: confirmar que la tarjeta "Eliminar lead" no aparece en el detalle.

- [ ] **Step 5: Detener el servidor y commitear**

```bash
git add app/composables/useLeads.ts app/pages/leads/\[id\].vue
git commit -m "$(cat <<'EOF'
Agregar eliminar lead desde el detalle

deleteLead() sigue el mismo patrón que deleteCliente(). Sin caso
especial de foreign key: nada bloquea el borrado de un lead (las
interacciones se borran solas por ON DELETE CASCADE, y tareas/
notificaciones quedan huérfanas a propósito, según el spec).
EOF
)"
```

---

### Task 2: Eliminar ticket desde el detalle (`/tickets/[id]`)

**Files:**
- Modify: `app/composables/useTickets.ts`
- Modify: `app/pages/tickets/[id].vue`

**Interfaces:**
- Consumes: `SharedConfirmDialog` (ya existe).
- Produces: `deleteTicket(id: string): Promise<void>` en `useTickets.ts`. Independiente de la Task 1.

- [ ] **Step 1: Agregar `deleteTicket` a `useTickets.ts`**

Reemplazar el contenido completo de `app/composables/useTickets.ts`:

```ts
// composables/useTickets.ts

export type EstadoTicket = 'abierto' | 'en_proceso' | 'esperando_cliente' | 'resuelto' | 'cerrado'
export type PrioridadTicket = 'baja' | 'media' | 'alta' | 'urgente'

export interface Ticket {
  id: string
  cliente_id: string
  titulo: string
  descripcion: string | null
  estado: EstadoTicket
  prioridad: PrioridadTicket
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  version: number
}

export const useTickets = () => {
  const supabase = useSupabaseClient()

  const fetchTickets = async (filtroEstado?: EstadoTicket) => {
    let query = supabase.from('tickets').select('*').order('created_at', { ascending: false })
    if (filtroEstado) query = query.eq('estado', filtroEstado)
    const { data, error } = await query
    if (error) throw error
    return data as Ticket[]
  }

  const fetchTicketsPorCliente = async (clienteId: string) => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as Ticket[]
  }

  const getTicket = async (id: string) => {
    const { data, error } = await supabase.from('tickets').select('*').eq('id', id).single()
    if (error) throw error
    return data as Ticket
  }

  const createTicket = async (payload: Partial<Ticket>) => {
    const { data, error } = await supabase.from('tickets').insert(payload).select().single()
    if (error) throw error
    return data as Ticket
  }

  const updateTicket = async (id: string, payload: Partial<Ticket>, expectedVersion?: number) => {
    let query = supabase
      .from('tickets')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (expectedVersion !== undefined) query = query.eq('version', expectedVersion)

    const { data, error } = await query.select().maybeSingle()
    if (error) throw error

    if (expectedVersion !== undefined && !data) {
      throw new Error('CONFLICTO_VERSION')
    }
    return data as Ticket
  }

  const deleteTicket = async (id: string) => {
    const { error } = await supabase.from('tickets').delete().eq('id', id)
    if (error) throw error
  }

  const cambiarEstado = (id: string, estado: EstadoTicket) => updateTicket(id, { estado })

  // requiere permiso tickets.assign - RLS lo valida server-side, esto es solo el wrapper
  const asignarTecnico = (id: string, ownerId: string) => updateTicket(id, { owner_id: ownerId })

  return {
    fetchTickets,
    fetchTicketsPorCliente,
    getTicket,
    createTicket,
    updateTicket,
    deleteTicket,
    cambiarEstado,
    asignarTecnico,
  }
}
```

- [ ] **Step 2: Agregar la tarjeta de eliminar en `tickets/[id].vue`**

Reemplazar el contenido completo de `app/pages/tickets/[id].vue`:

```vue
<script setup lang="ts">
import type { Ticket } from '~/composables/useTickets'
import type { Usuario } from '~/composables/useUsuarios'

definePageMeta({
  middleware: 'permission',
  permiso: { resource: 'tickets', actions: ['view', 'view_all'] },
})

const route = useRoute()
const { getTicket, updateTicket, deleteTicket, asignarTecnico } = useTickets()
const { fetchUsuariosPorRol } = useUsuarios()
const { can } = usePermissions()
const { success, error } = useToast()

const ticket = ref<Ticket | null>(null)
const tecnicos = ref<Usuario[]>([])
const cargando = ref(true)
const guardando = ref(false)
const asignando = ref(false)
const confirmandoEliminar = ref(false)
const eliminando = ref(false)

onMounted(async () => {
  ticket.value = await getTicket(route.params.id as string)
  if (can('tickets', 'assign')) {
    tecnicos.value = await fetchUsuariosPorRol('servicio_tecnico')
  }
  cargando.value = false
})

const onSubmit = async (payload: Record<string, unknown>) => {
  if (!ticket.value) return
  guardando.value = true
  try {
    ticket.value = await updateTicket(ticket.value.id, payload, ticket.value.version)
    success('Ticket actualizado')
  } catch (e: any) {
    if (e.message === 'CONFLICTO_VERSION') {
      error('Alguien más modificó este ticket mientras lo tenías abierto. Se recargaron los datos actuales, revisa e intenta de nuevo.')
      ticket.value = await getTicket(route.params.id as string)
    } else {
      error('No se pudo guardar el cambio. Intenta de nuevo.')
    }
  } finally {
    guardando.value = false
  }
}

const onAsignar = async (tecnicoId: string) => {
  if (!ticket.value || !tecnicoId) return
  asignando.value = true
  try {
    ticket.value = await asignarTecnico(ticket.value.id, tecnicoId)
    success('Técnico asignado')
  } catch (e) {
    error('No se pudo asignar el técnico. Intenta de nuevo.')
  } finally {
    asignando.value = false
  }
}

async function onConfirmarEliminar() {
  if (!ticket.value) return
  eliminando.value = true
  try {
    await deleteTicket(ticket.value.id)
    success('Ticket eliminado')
    await navigateTo('/tickets')
  } catch (e) {
    error('No se pudo eliminar el ticket. Intenta de nuevo.')
    eliminando.value = false
    confirmandoEliminar.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-lg">
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <template v-else-if="ticket">
      <SharedPageHeader :titulo="ticket.titulo" volver-a="/tickets">
        <template #accion>
          <SharedBadge :label="colorTicket(ticket.estado).label" :clases="colorTicket(ticket.estado).clases" />
        </template>
      </SharedPageHeader>

      <SharedCard>
        <TicketsTicketForm :model-value="ticket" :cargando="guardando" @submit="onSubmit" />
      </SharedCard>

      <div v-if="can('tickets', 'assign')" class="mt-6">
        <SharedCard titulo="Técnico asignado">
          <select
            :value="ticket.owner_id ?? ''"
            :disabled="asignando"
            class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
            @change="onAsignar(($event.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>Sin asignar</option>
            <option v-for="t in tecnicos" :key="t.id" :value="t.id">
              {{ t.full_name || t.email }}
            </option>
          </select>
        </SharedCard>
      </div>

      <div v-if="can('tickets', 'delete')" class="mt-6">
        <SharedCard>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold text-gray-700">Eliminar ticket</h2>
              <p class="text-xs text-gray-400 mt-1">Esta acción no se puede deshacer.</p>
            </div>
            <button
              type="button"
              class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              @click="confirmandoEliminar = true"
            >
              Eliminar ticket
            </button>
          </div>
        </SharedCard>
      </div>

      <SharedConfirmDialog
        :open="confirmandoEliminar"
        titulo="Eliminar ticket"
        :mensaje="`¿Eliminar &quot;${ticket.titulo}&quot;? Esta acción no se puede deshacer.`"
        :cargando="eliminando"
        @confirmar="onConfirmarEliminar"
        @cancelar="confirmandoEliminar = false"
      />
    </template>
    <p v-else class="text-red-600">Ticket no encontrado</p>
  </div>
</template>
```

- [ ] **Step 3: `rm -rf .nuxt` y levantar el dev server**

```bash
rm -rf .nuxt
npm run dev
```

- [ ] **Step 4: Checklist manual de navegador (para el usuario)**

1. Como usuario con `tickets.delete`: entrar al detalle de un ticket. Confirmar que aparece la tarjeta "Eliminar ticket" con el botón rojo.
2. Click en "Eliminar ticket", confirmar que aparece el modal con el título del ticket entre comillas. Click en "Cancelar": el modal se cierra, el ticket sigue intacto.
3. Repetir y confirmar. Verificar que redirige a `/tickets` con el toast "Ticket eliminado" y que el Kanban ya no muestra ese ticket.
4. Como usuario sin `tickets.delete`: confirmar que la tarjeta "Eliminar ticket" no aparece en el detalle.

- [ ] **Step 5: Detener el servidor y commitear**

```bash
git add app/composables/useTickets.ts app/pages/tickets/\[id\].vue
git commit -m "$(cat <<'EOF'
Agregar eliminar ticket desde el detalle

deleteTicket() sigue el mismo patrón que deleteCliente()/deleteLead().
Sin caso especial de foreign key: nada bloquea el borrado de un
ticket.
EOF
)"
```

---

## Self-Review (completado durante la escritura del plan)

**Cobertura del spec:**
- `deleteLead`/`deleteTicket` en los composables → Task 1 Step 1, Task 2 Step 1. ✓
- Tarjeta "Eliminar" solo en detalle, gateada por permiso, sin tocar Kanban → Task 1 Step 2, Task 2 Step 2. ✓
- `router.push('/leads')` en leads (consistente con el uso existente de `router` en ese archivo) vs `navigateTo('/tickets')` en tickets (sin precedente de `router` ahí) → reflejado exactamente en el código de ambos steps. ✓
- Sin manejo especial de `e.code` (a diferencia de clientes) → catch genérico en ambas tareas. ✓
- Decisión de dejar tareas/notificaciones huérfanas → no se tocó `useTareas.ts` ni `useNotificaciones.ts` en ningún paso. ✓
- Los 5 (Task 1) / 4 (Task 2) puntos de testing manual del spec → checklists de Step 4 en ambas tareas. ✓
- "Fuera de alcance" del spec (Kanban, cascada, soft-delete, `useClientes.ts`) → ningún archivo de esos tocado. ✓

**Placeholders:** ninguno — cada archivo modificado se entrega completo.

**Consistencia de tipos:** `deleteLead(id: string)` y `deleteTicket(id: string)` mismo shape que `deleteCliente(id: string)` (ya en el repo, no se modifica). `SharedConfirmDialog` recibe las mismas props/emits que en la feature de clientes, sin cambios a ese componente. Las dos tareas no comparten ningún archivo — son completamente independientes entre sí, se pueden implementar/revisar en cualquier orden.
