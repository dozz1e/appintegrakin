# Calendario visual para agenda de capacitaciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un calendario visual mensual a `/capacitaciones`, en columna junto al listado existente, sin cambiar el modelo de datos.

**Architecture:** Componente presentacional nuevo `CapacitacionesCalendarioMes.vue` que recibe las citas ya cargadas por `index.vue` (mismo array, sin fetch nuevo) y expone `v-model:fecha-seleccionada`. `index.vue` pasa de una columna a un layout de dos (`grid grid-cols-1 lg:grid-cols-[1.3fr_1fr]`), y su `citasFiltradas` cambia de fuente según haya día seleccionado en el calendario.

**Tech Stack:** Nuxt 4 / Vue 3, Tailwind — mismo stack que el resto del repo, sin librerías nuevas (el proyecto no usa ninguna librería de fechas ni de calendario hoy).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-15-agenda-capacitaciones-calendario-design.md`.
- **No hay suite de tests automatizada en este proyecto** (sin `vitest`/`jest`, sin archivos `*.test.*`/`*.spec.*`). Verificación manual: `npm run build` para confirmar que compila/typechecks, y prueba en navegador (`npm run dev`) para el comportamiento.
- Componentes nuevos requieren `rm -rf .nuxt && npm run dev` — el hot-reload no alcanza (Gotcha #2 de `CONTEXTO_PROYECTO.md`).
- Sin dependencia nueva: calendario hecho a mano con Tailwind, mismo patrón que `SharedBadge`/`SharedModal`.
- Dot simple (presencia/ausencia), sin contador ni color por estado.
- Click en día reemplaza el filtro manual desde/hasta; click de nuevo sobre el mismo día deselecciona.
- Color de marca para selección/hoy: `#1075B5` (ya usado en botones primarios de `index.vue`).

---

### Task 1: Componente `CapacitacionesCalendarioMes.vue`

**Files:**
- Create: `app/components/capacitaciones/CalendarioMes.vue`

**Interfaces:**
- Produces: componente `<CapacitacionesCalendarioMes>` (auto-import por convención de carpeta, igual que `CapacitacionesCitaForm`), props `{ citas: CitaCapacitacionConNombres[], fechaSeleccionada: string | null }`, emit `update:fechaSeleccionada` con `string | null` (formato `YYYY-MM-DD`, hora local).
- Consumes: tipo `CitaCapacitacionConNombres` de `~/composables/useCitasCapacitacion` (ya existe, sin cambios).

- [ ] **Step 1: Crear el componente**

```vue
<!-- app/components/capacitaciones/CalendarioMes.vue -->
<script setup lang="ts">
import type { CitaCapacitacionConNombres } from '~/composables/useCitasCapacitacion'

const props = defineProps<{
  citas: CitaCapacitacionConNombres[]
  fechaSeleccionada: string | null
}>()

const emit = defineEmits<{
  'update:fechaSeleccionada': [fecha: string | null]
}>()

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const hoy = new Date()
const mesCursor = ref(new Date(hoy.getFullYear(), hoy.getMonth(), 1))

const aniosDisponibles = computed(() => {
  const actual = hoy.getFullYear()
  const anios: number[] = []
  for (let a = actual - 5; a <= actual + 5; a++) anios.push(a)
  return anios
})

function mesAnterior() {
  mesCursor.value = new Date(mesCursor.value.getFullYear(), mesCursor.value.getMonth() - 1, 1)
}

function mesSiguiente() {
  mesCursor.value = new Date(mesCursor.value.getFullYear(), mesCursor.value.getMonth() + 1, 1)
}

function cambiarAnio(anio: number) {
  mesCursor.value = new Date(anio, mesCursor.value.getMonth(), 1)
}

function formatearKey(fecha: Date): string {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const citasPorDia = computed(() => {
  const set = new Set<string>()
  for (const c of props.citas) {
    set.add(c.fecha_hora.slice(0, 10))
  }
  return set
})

interface CeldaCalendario {
  fecha: Date
  key: string
  enMes: boolean
}

const celdas = computed<CeldaCalendario[]>(() => {
  const primerDiaMes = new Date(mesCursor.value.getFullYear(), mesCursor.value.getMonth(), 1)
  const inicioGrilla = new Date(primerDiaMes)
  inicioGrilla.setDate(inicioGrilla.getDate() - primerDiaMes.getDay())

  const resultado: CeldaCalendario[] = []
  const cursor = new Date(inicioGrilla)
  for (let i = 0; i < 42; i++) {
    resultado.push({
      fecha: new Date(cursor),
      key: formatearKey(cursor),
      enMes: cursor.getMonth() === mesCursor.value.getMonth(),
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return resultado
})

function onDiaClick(key: string) {
  emit('update:fechaSeleccionada', props.fechaSeleccionada === key ? null : key)
}

const keyHoy = formatearKey(hoy)
</script>

<template>
  <div class="border border-gray-100 rounded-xl p-4">
    <div class="flex items-center justify-between mb-4">
      <button type="button" class="text-gray-400 hover:text-gray-700 px-2 text-lg" @click="mesAnterior">‹</button>
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-gray-800">{{ MESES[mesCursor.getMonth()] }}</span>
        <select
          class="border border-gray-200 rounded-lg px-2 py-1 text-sm"
          :value="mesCursor.getFullYear()"
          @change="cambiarAnio(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="anio in aniosDisponibles" :key="anio" :value="anio">{{ anio }}</option>
        </select>
      </div>
      <button type="button" class="text-gray-400 hover:text-gray-700 px-2 text-lg" @click="mesSiguiente">›</button>
    </div>

    <div class="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
      <span v-for="dia in DIAS_SEMANA" :key="dia">{{ dia }}</span>
    </div>

    <div class="grid grid-cols-7 gap-1">
      <button
        v-for="celda in celdas"
        :key="celda.key"
        type="button"
        class="min-h-[90px] rounded-lg p-2 flex flex-col items-center gap-1 border transition-colors"
        :class="[
          celda.enMes ? 'text-gray-800' : 'text-gray-300',
          celda.key === fechaSeleccionada
            ? 'bg-[#1075B5] text-white border-[#1075B5]'
            : celda.key === keyHoy
              ? 'border-[#1075B5] border-2'
              : 'border-gray-100 hover:bg-gray-50',
        ]"
        @click="onDiaClick(celda.key)"
      >
        <span class="text-sm">{{ celda.fecha.getDate() }}</span>
        <span
          v-if="citasPorDia.has(celda.key)"
          class="w-1.5 h-1.5 rounded-full"
          :class="celda.key === fechaSeleccionada ? 'bg-white' : 'bg-[#1075B5]'"
        />
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Verificar que compila**

Run: `rm -rf .nuxt && npm run build`
Expected: build termina sin errores de TypeScript ni de Vue (el componente no está usado en ninguna página todavía, así que no hay verificación visual en este paso — se hace en Task 2).

- [ ] **Step 3: Commit**

```bash
git add app/components/capacitaciones/CalendarioMes.vue
git commit -m "feat: componente CalendarioMes para agenda de capacitaciones"
```

---

### Task 2: Integrar el calendario en `/capacitaciones`

**Files:**
- Modify: `app/pages/capacitaciones/index.vue`

**Interfaces:**
- Consumes: `<CapacitacionesCalendarioMes :citas :fecha-seleccionada @update:fecha-seleccionada>` de Task 1.

- [ ] **Step 1: Agregar estado `fechaSeleccionada` y reescribir `citasFiltradas`**

En `app/pages/capacitaciones/index.vue`, reemplazar:

```ts
const filtroDesde = ref('')
const filtroHasta = ref('')
```

por:

```ts
const filtroDesde = ref('')
const filtroHasta = ref('')
const fechaSeleccionada = ref<string | null>(null)
```

Y reemplazar el `computed` `citasFiltradas` completo:

```ts
const citasFiltradas = computed(() => {
  if (fechaSeleccionada.value) {
    return citas.value.filter((c) => c.fecha_hora.slice(0, 10) === fechaSeleccionada.value)
  }
  return citas.value.filter((c) => {
    const t = new Date(c.fecha_hora).getTime()
    if (filtroDesde.value && t < new Date(filtroDesde.value).getTime()) return false
    if (filtroHasta.value) {
      const finDia = new Date(filtroHasta.value)
      finDia.setHours(23, 59, 59, 999)
      if (t > finDia.getTime()) return false
    }
    return true
  })
})
```

- [ ] **Step 2: Agregar handler de click de día y limpiar filtro manual al usar `Hoy`/`Esta semana`**

Agregar después de `filtrarEstaSemana`:

```ts
function onDiaClick(fecha: string | null) {
  fechaSeleccionada.value = fecha
  if (fecha) {
    filtroDesde.value = ''
    filtroHasta.value = ''
  }
}
```

Modificar `filtrarHoy` y `filtrarEstaSemana` para limpiar la selección de día al usarse:

```ts
function filtrarHoy() {
  fechaSeleccionada.value = null
  const hoy = new Date().toISOString().slice(0, 10)
  filtroDesde.value = hoy
  filtroHasta.value = hoy
}

function filtrarEstaSemana() {
  fechaSeleccionada.value = null
  const ahora = new Date()
  const inicio = new Date(ahora)
  inicio.setDate(ahora.getDate() - ahora.getDay())
  const fin = new Date(inicio)
  fin.setDate(inicio.getDate() + 6)
  filtroDesde.value = inicio.toISOString().slice(0, 10)
  filtroHasta.value = fin.toISOString().slice(0, 10)
}
```

- [ ] **Step 3: Layout de dos columnas + inputs manuales limpian la selección de día**

Reemplazar el bloque del template desde el `<div class="flex flex-wrap gap-2 mb-4">` de filtros hasta el cierre del `<ul>`/mensajes de listado (todo lo que hoy está entre `SharedPageHeader` y el `SharedModal`) por:

```html
    <div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
      <CapacitacionesCalendarioMes
        :citas="citas"
        :fecha-seleccionada="fechaSeleccionada"
        @update:fecha-seleccionada="onDiaClick"
      />

      <div>
        <div class="flex flex-wrap gap-2 mb-4">
          <input
            v-model="filtroDesde"
            type="date"
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            @change="fechaSeleccionada = null"
          />
          <input
            v-model="filtroHasta"
            type="date"
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            @change="fechaSeleccionada = null"
          />
          <button class="text-sm text-[#1075B5] hover:underline" @click="filtrarHoy">Hoy</button>
          <button class="text-sm text-[#1075B5] hover:underline" @click="filtrarEstaSemana">Esta semana</button>
        </div>

        <p v-if="cargando" class="text-gray-400">Cargando...</p>
        <p v-else-if="!citasFiltradas.length" class="text-gray-400">Sin capacitaciones para el rango elegido.</p>

        <ul v-else class="space-y-2">
          <li
            v-for="c in citasFiltradas"
            :key="c.id"
            class="border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-3"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-800">{{ c.cliente_nombre }} — {{ c.producto_nombre }}</p>
              <p class="text-xs text-gray-400">{{ formatearFecha(c.fecha_hora) }} · {{ c.titulo }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <SharedBadge :label="colorCitaCapacitacion(c.estado).label" :clases="colorCitaCapacitacion(c.estado).clases" />
              <button class="text-xs text-[#1075B5] hover:underline" @click="abrirEditar(c)">Editar</button>
              <button
                v-if="c.estado === 'pendiente'"
                class="text-xs text-green-600 hover:underline"
                @click="cambiarEstado(c, 'completada')"
              >
                Completar
              </button>
              <button
                v-if="c.estado === 'pendiente'"
                class="text-xs text-red-600 hover:underline"
                @click="cambiarEstado(c, 'cancelada')"
              >
                Cancelar
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
```

(El `SharedPageHeader` antes de este bloque y el `SharedModal` después no cambian.)

- [ ] **Step 4: Reiniciar dev server y verificar en navegador**

Run: `rm -rf .nuxt && npm run dev`

En el navegador, en `/capacitaciones`, verificar (checklist del spec):
1. El calendario se ve grande, a la izquierda; el listado a la derecha. En una pestaña angosta, se apilan.
2. Días con citas existentes muestran el dot. El día de hoy tiene borde azul.
3. Click en un día con citas → el listado se filtra a ese día, los inputs desde/hasta quedan vacíos.
4. Click de nuevo sobre el mismo día → deselecciona, listado vuelve a mostrar todo.
5. Con un día seleccionado, click en "Hoy" o "Esta semana" → limpia la selección del calendario, filtra por el rango del botón.
6. Con un día seleccionado, cambiar el input `filtroDesde` o `filtroHasta` manualmente → limpia la selección del calendario.
7. Flechas `‹`/`›` y el selector de año navegan el calendario sin afectar el listado ni la selección de día.
8. Día con múltiples citas (crear una segunda cita el mismo día que otra existente desde "+ Nueva capacitación") → un solo dot, el listado filtrado muestra ambas.
9. Click en un día gris (mes anterior/siguiente, fuera del mes actual) → filtra el listado igual que un día normal (no es solo decorativo).

Expected: los 9 puntos se cumplen sin errores en consola.

- [ ] **Step 5: Commit**

```bash
git add app/pages/capacitaciones/index.vue
git commit -m "feat: integrar calendario visual en /capacitaciones"
```
