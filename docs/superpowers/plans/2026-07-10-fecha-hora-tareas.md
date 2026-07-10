# Fecha y hora en tareas/recordatorios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un selector de hora nativo junto al de fecha en el formulario de "Tareas y recordatorios" (compartido entre clientes/leads/tickets), para que las tareas venzan a una hora precisa en vez de siempre a medianoche.

**Architecture:** Cambio de un solo archivo, `app/components/shared/TareaList.vue`. Se agrega un segundo `ref` (`horaVencimiento`) con su `<input type="time">`, y una función `construirFechaVencimiento()` que combina fecha+hora en un timestamp ISO correcto (mismo patrón `new Date(...).toISOString()` que ya usan `updateLead`/`updateCliente`/`updateTicket`). `formatearFecha()` se extiende para mostrar la hora solo cuando no es el default (`23:59`). `useTareas.ts` no cambia — `crearTarea` sigue recibiendo un `string | null` ya combinado.

**Tech Stack:** Nuxt 4 / Vue 3. Sin dependencias nuevas (inputs nativos del navegador).

## Global Constraints

- Alcance: las tres entidades (clientes, leads, tickets) — es el mismo componente compartido, no se bifurca por tipo de entidad.
- Sin librería de datepicker nueva — inputs nativos `date` + `time` únicamente (decisión explícita del spec).
- Hora por defecto si se omite: `23:59` del día elegido.
- Mostrar la hora en el listado solo si no es el default `23:59`.
- `useTareas.ts` no cambia de firma — `crearTarea(entidadTipo, entidadId, titulo, fechaVencimiento: string | null)` sigue igual; el combinado fecha+hora ocurre antes, en `TareaList.vue`.
- Componentes modificados requieren `rm -rf .nuxt && npm run dev` para que Nuxt los tome — el hot-reload no alcanza.
- Nada de tests automatizados en este repo todavía — la verificación es un checklist manual de navegador en las tres páginas de detalle.
- Sin comentarios explicativos salvo que documenten un porqué no obvio.

---

### Task 1: Selector de hora en `TareaList.vue`

**Files:**
- Modify: `app/components/shared/TareaList.vue`

**Interfaces:**
- Consumes: `crearTarea(entidadTipo, entidadId, titulo, fechaVencimiento: string | null)` de `useTareas.ts` (sin cambios, ya existente).
- Produces: nada consumido por otra tarea — es la única tarea del plan.

- [ ] **Step 1: Reemplazar el contenido completo de `TareaList.vue`**

```vue
<script setup lang="ts">
import type { Tarea } from '~/composables/useTareas'

const props = defineProps<{
  entidadTipo: Tarea['entidad_tipo']
  entidadId: string
}>()

const { fetchTareasPorEntidad, crearTarea, marcarCompletada } = useTareas()
const { success, error } = useToast()

const tareas = ref<Tarea[]>([])
const cargando = ref(true)
const guardando = ref(false)

const titulo = ref('')
const fechaVencimiento = ref('')
const horaVencimiento = ref('')

async function cargar() {
  cargando.value = true
  tareas.value = await fetchTareasPorEntidad(props.entidadTipo, props.entidadId)
  cargando.value = false
}

onMounted(cargar)

// Si se omite la hora, la tarea vence al final del día elegido (23:59) en
// vez de a medianoche — evita que una tarea "para hoy" se marque vencida
// apenas empieza el día.
function construirFechaVencimiento(fecha: string, hora: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const [horas, minutos] = hora ? hora.split(':').map(Number) : [23, 59]
  return new Date(anio, mes - 1, dia, horas, minutos, 0).toISOString()
}

async function onSubmit() {
  if (!titulo.value.trim()) return
  guardando.value = true
  try {
    await crearTarea(
      props.entidadTipo,
      props.entidadId,
      titulo.value.trim(),
      fechaVencimiento.value ? construirFechaVencimiento(fechaVencimiento.value, horaVencimiento.value) : null
    )
    titulo.value = ''
    fechaVencimiento.value = ''
    horaVencimiento.value = ''
    await cargar()
    success('Tarea creada')
  } catch (e) {
    error('No se pudo crear la tarea')
  } finally {
    guardando.value = false
  }
}

async function onToggle(tarea: Tarea) {
  try {
    await marcarCompletada(tarea.id, !tarea.completada)
    await cargar()
  } catch (e) {
    error('No se pudo actualizar la tarea')
  }
}

function esVencida(tarea: Tarea) {
  return !tarea.completada && tarea.fecha_vencimiento && new Date(tarea.fecha_vencimiento) < new Date()
}

function formatearFecha(fecha: string) {
  const d = new Date(fecha)
  const esDefault = d.getHours() === 23 && d.getMinutes() === 59
  const base = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
  if (esDefault) return base
  return `${base}, ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
}
</script>

<template>
  <SharedCard titulo="Tareas y recordatorios">
    <div class="flex gap-2 mb-4">
      <input
        v-model="titulo"
        type="text"
        placeholder="Ej: Llamar en 3 días"
        class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
        @keyup.enter="onSubmit"
      />
      <input
        v-model="fechaVencimiento"
        type="date"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
      />
      <input
        v-model="horaVencimiento"
        type="time"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
      />
      <button
        :disabled="guardando || !titulo.trim()"
        class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        @click="onSubmit"
      >
        Agregar
      </button>
    </div>

    <p v-if="cargando" class="text-sm text-gray-400">Cargando tareas...</p>
    <p v-else-if="!tareas.length" class="text-sm text-gray-400">Sin tareas pendientes.</p>

    <ul v-else class="space-y-2">
      <li
        v-for="t in tareas"
        :key="t.id"
        class="flex items-center gap-3 p-2 rounded-lg"
        :class="esVencida(t) ? 'bg-red-50' : 'bg-gray-50'"
      >
        <input
          type="checkbox"
          :checked="t.completada"
          class="w-4 h-4 accent-[#1075B5]"
          @change="onToggle(t)"
        />
        <span class="flex-1 text-sm" :class="t.completada ? 'line-through text-gray-400' : 'text-gray-700'">
          {{ t.titulo }}
        </span>
        <span v-if="t.fecha_vencimiento" class="text-xs" :class="esVencida(t) ? 'text-red-600 font-medium' : 'text-gray-400'">
          {{ formatearFecha(t.fecha_vencimiento) }}
        </span>
      </li>
    </ul>
  </SharedCard>
</template>
```

- [ ] **Step 2: `rm -rf .nuxt` y levantar el dev server**

```bash
rm -rf .nuxt
npm run dev
```

- [ ] **Step 3: Checklist manual de navegador (para el usuario)**

Repetir estos 5 casos en las tres páginas de detalle (`/clientes/<id>`,
`/leads/<id>`, `/tickets/<id>`) — mismo componente compartido, debe
comportarse igual en las tres:

1. Crear una tarea con fecha de hoy y sin hora. Confirmar que el listado
   muestra solo la fecha (ej. `"10 jul"`, sin hora) y que la tarea NO
   aparece marcada como vencida (fondo rojo) hasta que efectivamente pase
   la medianoche del día siguiente.
2. Crear una tarea con fecha de hoy y una hora ya pasada (ej. hace 5
   minutos). Confirmar que aparece inmediatamente con fondo rojo
   (`esVencida`) y que el listado muestra `"10 jul, HH:MM"` con la hora
   elegida.
3. Crear una tarea con fecha futura y una hora específica (ej. mañana a
   las 14:30). Confirmar que el listado muestra `"<fecha>, 14:30"` — la
   misma hora que se ingresó, no desplazada por zona horaria.
4. Confirmar que una tarea sin fecha (ambos campos vacíos) se sigue
   creando sin fecha de vencimiento, sin badge de fecha en el listado.
5. Confirmar que el botón "Agregar" sigue deshabilitado si el título está
   vacío, sin importar si se completó fecha/hora.

- [ ] **Step 4: Commit**

```bash
git add app/components/shared/TareaList.vue
git commit -m "$(cat <<'EOF'
Agregar selector de hora a tareas y recordatorios

TareaList.vue (compartido entre clientes/leads/tickets) combina fecha
+ hora en un timestamp con new Date(...).toISOString(), mismo patrón
que updateLead/updateCliente/updateTicket. Si se omite la hora, la
tarea vence a las 23:59 del día elegido en vez de a medianoche. El
listado muestra la hora solo cuando no es ese default.
EOF
)"
```

---

## Self-Review (completado durante la escritura del plan)

**Cobertura del spec:**
- Alcance a las tres entidades → Step 1 modifica el componente compartido único, sin bifurcación; Step 3 verifica las tres páginas. ✓
- Inputs nativos, sin librería nueva → Step 1 usa `<input type="date">` + `<input type="time">`. ✓
- Default `23:59` si se omite la hora → `construirFechaVencimiento` en Step 1. ✓
- `new Date(componentes).toISOString()` (zona horaria local correcta) → Step 1, mismo patrón que `updateLead`/`updateCliente`/`updateTicket`. ✓
- Mostrar hora solo si no es el default → `formatearFecha` en Step 1. ✓
- `useTareas.ts` sin cambios → no se modifica ese archivo en ningún step. ✓
- Los 5 escenarios de testing del spec, en las tres entidades → Step 3. ✓
- Fuera de alcance del spec (edición de tarea existente, validación de fecha futura, cambios de schema) → ningún step los toca. ✓

**Placeholders:** ninguno — el archivo se entrega completo, sin fragmentos parciales.

**Consistencia de tipos:** `construirFechaVencimiento(fecha: string, hora: string): string` solo se usa dentro de `onSubmit`, mismo archivo. `crearTarea(entidadTipo, entidadId, titulo, fechaVencimiento: string | null)` no cambia de firma respecto al archivo actual — se sigue llamando igual, solo cambia el valor que se le pasa como cuarto argumento.
