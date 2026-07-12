# Vista de detalle de Lead en columnas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar `app/pages/leads/[id].vue` en un grid de 3 columnas (info+acciones | historial de interacciones | tareas y recordatorios), apilado en una sola columna por debajo del breakpoint `lg`.

**Architecture:** Cambio puramente de template/CSS en un único archivo Vue. Se envuelve el bloque de contenido existente (una vez cargado el lead) en un `<div>` con `grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr]`, agrupando la info+acciones en la primera columna y moviendo `LeadsLeadTimeline` y `SharedTareaList` a columnas propias. No se toca ningún composable, prop, permiso ni lógica de negocio — `LeadsLeadTimeline` y `SharedTareaList` se usan con exactamente las mismas props que hoy.

**Tech Stack:** Nuxt 4 / Vue 3, Tailwind CSS.

## Global Constraints

- Alcance limitado a `app/pages/leads/[id].vue` — no se modifican `leads/index.vue`, `LeadKanban.vue`, `clientes/[id].vue`, ni ningún composable (`useLeads`, `useLeadInteracciones`, `useTareas`).
- No se agregan tabs, buscador ni elementos nuevos: es reubicar bloques existentes en un grid.
- Proyecto sin suite de tests automatizada — verificación vía `npm run build` (type-check de Nuxt/Vue) más testing manual en navegador.
- Usar `node`/`npm` del sistema (no `bun`) para cualquier comando.

---

### Task 1: Grid de 3 columnas en `leads/[id].vue`

**Files:**
- Modify: `app/pages/leads/[id].vue:86-171`

**Interfaces:**
- Consumes: `LeadsLeadForm` (props `model-value`, `cargando`; emit `submit`), `LeadsLeadTimeline` (prop `lead-id`), `SharedTareaList` (props `entidad-tipo`, `entidad-id`), `SharedCard`, `SharedConfirmDialog` — todos sin cambios de interfaz, ya usados en el archivo actual.
- Produces: nada — este es el único task del plan.

- [ ] **Step 1: Reemplazar el contenedor raíz y envolver el contenido en el grid de 3 columnas**

Reemplazar el bloque completo de `<template>` (líneas 85-172) por:

```html
<template>
  <div class="p-6 max-w-6xl">
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <template v-else-if="lead">
      <SharedPageHeader :titulo="lead.nombre" volver-a="/leads">
        <template #accion>
          <SharedBadge :label="colorLead(lead.estado).label" :clases="colorLead(lead.estado).clases" />
        </template>
      </SharedPageHeader>

      <div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr] gap-6 items-start">
        <div class="space-y-6">
          <SharedCard>
            <LeadsLeadForm :model-value="lead" :cargando="guardando" @submit="onSubmit" />
          </SharedCard>

          <SharedCard v-if="lead.cliente_id">
            <p class="text-sm text-gray-600">
              Este lead ya fue convertido en cliente.
              <NuxtLink :to="`/clientes/${lead.cliente_id}`" class="text-[#1075B5] hover:underline font-medium">
                Ver cliente
              </NuxtLink>
            </p>
          </SharedCard>

          <SharedCard v-else-if="puedeConvertir" titulo="Convertir a cliente">
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

          <SharedCard v-if="can('leads', 'delete')">
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

        <LeadsLeadTimeline :lead-id="lead.id" />

        <SharedTareaList entidad-tipo="lead" :entidad-id="lead.id" />
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

No se toca el bloque `<script setup>` (líneas 1-83) — todas las variables (`lead`, `cargando`, `guardando`, `convirtiendo`, `errorConversion`, `confirmandoEliminar`, `eliminando`, `rutConversion`, `razonSocialConversion`, `puedeConvertir`, `onSubmit`, `onConvertir`, `onConfirmarEliminar`) siguen usándose exactamente igual.

- [ ] **Step 2: Verificar que el build pasa**

Run: `npm run build`
Expected: build termina sin errores de TypeScript/Vue (mismo resultado que antes del cambio — no se introdujeron props, tipos ni imports nuevos).

- [ ] **Step 3: Testing manual en navegador**

Con `npm run dev` corriendo, abrir el detalle de un lead existente (`/leads/<id>`) y verificar contra la spec (`docs/superpowers/specs/2026-07-12-leads-detalle-columnas-design.md`, sección "Testing"):

1. En pantalla ≥1024px: 3 columnas visibles simultáneamente — info (más ancha) a la izquierda, historial al centro, tareas a la derecha.
2. La columna de historial muestra únicamente `LeadsLeadTimeline` (sin mezclarse con tareas o info).
3. La columna de tareas muestra únicamente `SharedTareaList` con las tareas del lead.
4. Reducir el ancho de la ventana por debajo de 1024px: las 3 columnas se apilan en orden Info → Historial → Tareas, sin overflow horizontal.
5. Con un lead sin `cliente_id` y usuario con permiso de convertir: la tarjeta "Convertir a cliente" aparece en la columna de info; convertir redirige a `/clientes/[id]`.
6. Con un lead ya convertido (`cliente_id` presente): aparece el aviso "Este lead ya fue convertido..." en vez de la tarjeta de convertir.
7. Con un usuario con permiso `leads.delete`: la tarjeta "Eliminar lead" aparece al final de la columna de info; el flujo de confirmación/eliminación funciona igual que antes.
8. Agregar una interacción nueva en el historial (columna 2): aparece sin afectar las otras columnas.
9. Crear una tarea nueva en la columna de tareas (columna 3): aparece sin afectar las otras columnas.

Si algún paso falla, corregir antes de continuar al commit.

- [ ] **Step 4: Commit**

```bash
git add app/pages/leads/\[id\].vue
git commit -m "$(cat <<'EOF'
Reorganizar vista de detalle de lead en 3 columnas

Info+acciones, historial de interacciones y tareas/recordatorios pasan
a columnas propias en un grid, apilado en pantallas angostas.
EOF
)"
```
