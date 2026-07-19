# Responsive Productos Listado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El listado de `/productos` se ve y usa bien en pantallas angostas (<1024px): header sin desbordar, buscador a todo el ancho, tabla reemplazada por cards apiladas. El fix de `SharedPageHeader.vue` es compartido y beneficia al resto de la Fase 2 (pendiente, casos separados).

**Architecture:** Cambios puramente de clases Tailwind (breakpoint `lg`, mismo criterio que las fases responsive anteriores — shell, Kanban, ClienteSplitView). Sin cambios de lógica: la tabla y las cards leen del mismo `productosFiltrados` ya existente.

**Tech Stack:** Nuxt 3, Tailwind CSS.

## Global Constraints

- Sin suite de tests automatizada — verificación es `npm run build` + prueba manual en navegador (DevTools responsive / celular real), la hace el usuario.
- Breakpoint `lg` (1024px) — mismo que usan shell/Kanban/ClienteSplitView, no introducir uno nuevo.
- No tocar `ProductosProductoForm.vue` ni la lógica de filtrado/paginación existente.
- Spec completo: `docs/superpowers/specs/2026-07-19-responsive-productos-listado-design.md`.

---

## Task 1: `SharedPageHeader.vue` — permitir que el header no desborde

**Files:**
- Modify: `app/components/shared/PageHeader.vue:6`

**Interfaces:**
- Consumes: nada nuevo (mismos props `titulo`/`volverA`, mismos slots `subtitulo`/`accion`).
- Produces: sin cambio de interfaz — solo cambia el layout CSS del contenedor raíz. Componente usado por casi todas las páginas de listado del proyecto (clientes, leads, tickets, post-venta, productos, admin/*, capacitaciones, historial/*).

- [ ] **Step 1: Agregar `flex-wrap` al contenedor raíz**

En `app/components/shared/PageHeader.vue:6`, reemplazar:

```html
  <div class="flex items-center justify-between mb-6">
```

por:

```html
  <div class="flex flex-wrap items-center justify-between gap-2 mb-6">
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: `✨ Build complete!` sin errores (cambio de clases CSS puro, no debería afectar tipos ni compilación).

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/PageHeader.vue
git commit -m "$(cat <<'EOF'
fix: prevent SharedPageHeader from overflowing on narrow screens

Adds flex-wrap so the title and action buttons drop to their own row
instead of getting squeezed when they don't fit — no visual change on
desktop where everything already fits in one row. Shared by nearly
every list page in the app, so this is a foundational fix for the
rest of Fase 2 (responsive listados).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `app/pages/productos/index.vue` — buscador a todo el ancho + tabla → cards

**Files:**
- Modify: `app/pages/productos/index.vue:181-186` (input de búsqueda)
- Modify: `app/pages/productos/index.vue:199-228` (bloque tabla)

**Interfaces:**
- Consumes: `productosFiltrados` (computed ya existente en el mismo archivo, línea 104-112), `colorEstado` (línea 114-117), `abrirEditar` (línea 31-34) — ninguno cambia de forma, solo se agregan más consumidores del mismo estado.

- [ ] **Step 1: Buscador a todo el ancho en mobile**

En `app/pages/productos/index.vue:181-186`, reemplazar:

```html
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por nombre o SKU..."
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
```

por:

```html
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por nombre o SKU..."
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      />
```

- [ ] **Step 2: Envolver la tabla en `hidden lg:block` y agregar las cards**

En `app/pages/productos/index.vue:199-228`, reemplazar el bloque completo:

```html
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="productosFiltrados.length === 0" class="p-10 text-center text-gray-400">
        {{ busqueda || filtroCategoria || filtroEstado ? 'Sin resultados para estos filtros' : 'Sin productos todavía' }}
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Nombre</th>
            <th class="px-4 py-3 font-medium">SKU</th>
            <th class="px-4 py-3 font-medium">Categoría</th>
            <th class="px-4 py-3 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr
            v-for="p in productosFiltrados"
            :key="p.id"
            class="cursor-pointer hover:bg-gray-50"
            @click="abrirEditar(p)"
          >
            <td class="px-4 py-3 text-gray-700 font-medium">{{ p.nombre }}</td>
            <td class="px-4 py-3 text-gray-500">{{ p.sku }}</td>
            <td class="px-4 py-3 text-gray-500">{{ p.categoria || '—' }}</td>
            <td class="px-4 py-3">
              <SharedBadge :label="p.estado === 'activo' ? 'Activo' : 'Inactivo'" :clases="colorEstado[p.estado]" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
```

por:

```html
    <p v-if="cargando" class="text-gray-400">Cargando...</p>
    <div v-else class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div v-if="productosFiltrados.length === 0" class="p-10 text-center text-gray-400">
        {{ busqueda || filtroCategoria || filtroEstado ? 'Sin resultados para estos filtros' : 'Sin productos todavía' }}
      </div>

      <div v-else class="hidden lg:block overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
              <th class="px-4 py-3 font-medium">Nombre</th>
              <th class="px-4 py-3 font-medium">SKU</th>
              <th class="px-4 py-3 font-medium">Categoría</th>
              <th class="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr
              v-for="p in productosFiltrados"
              :key="p.id"
              class="cursor-pointer hover:bg-gray-50"
              @click="abrirEditar(p)"
            >
              <td class="px-4 py-3 text-gray-700 font-medium">{{ p.nombre }}</td>
              <td class="px-4 py-3 text-gray-500">{{ p.sku }}</td>
              <td class="px-4 py-3 text-gray-500">{{ p.categoria || '—' }}</td>
              <td class="px-4 py-3">
                <SharedBadge :label="p.estado === 'activo' ? 'Activo' : 'Inactivo'" :clases="colorEstado[p.estado]" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="productosFiltrados.length" class="lg:hidden divide-y divide-gray-50">
        <div
          v-for="p in productosFiltrados"
          :key="p.id"
          class="p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100"
          @click="abrirEditar(p)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium text-gray-700 truncate">{{ p.nombre }}</span>
            <SharedBadge :label="p.estado === 'activo' ? 'Activo' : 'Inactivo'" :clases="colorEstado[p.estado]" />
          </div>
          <p class="text-xs text-gray-500 mt-1">{{ p.sku }} · {{ p.categoria || '—' }}</p>
        </div>
      </div>
    </div>
```

Nota: `v-if="productosFiltrados.length === 0"` (estado vacío) queda
igual, fuera de los dos bloques `lg:`/`hidden` — se muestra una sola
vez sin importar el ancho de pantalla, como ya era el caso.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: `✨ Build complete!` sin errores de template (dos `v-for` sobre `productosFiltrados` con el mismo `:key="p.id"` en bloques hermanos mutuamente excluyentes por CSS — válido en Vue, no es un `:key` duplicado en el mismo array renderizado).

- [ ] **Step 4: Commit**

```bash
git add app/pages/productos/index.vue
git commit -m "$(cat <<'EOF'
feat: responsive listado de productos (Fase 2, primer caso)

Tabla se reemplaza por cards apiladas debajo de 1024px (mismo criterio
que Kanban/ClienteSplitView: una presentación por ancho de pantalla,
mismo productosFiltrados). Buscador ocupa todo el ancho en mobile.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Verificación manual (usuario)

**Files:** ninguno — checklist de prueba en navegador, la ejecuta el usuario.

- [ ] **Step 1: Pasar la lista de verificación al usuario**

Avisar que están listos para probar, siguiendo el checklist del spec
(`docs/superpowers/specs/2026-07-19-responsive-productos-listado-design.md`,
sección "Testing"):

1. Ventana angosta (<1024px, o DevTools mobile) en `/productos`: el
   header (título + Exportar/Importar/+Nuevo) no se aprieta ni
   desborda.
2. Mismo ancho: se ve la lista como cards apiladas (nombre + badge de
   estado arriba, SKU y categoría abajo), no la tabla.
3. Tocar una card: abre el modal de edición, igual que hoy al hacer
   click en una fila de la tabla en desktop.
4. El input de búsqueda ocupa todo el ancho disponible en mobile.
5. Ensanchar a ≥1024px: vuelve la tabla de siempre, cards
   desaparecen, header en una sola fila — sin cambios respecto al
   comportamiento anterior a este plan.
6. Revisar de pasada 2-3 páginas más que usan `SharedPageHeader` (ej.
   `/clientes`, `/leads`) en mobile — confirmar que el fix del
   `flex-wrap` (Task 1, cambio compartido) no rompió nada ahí, aunque
   esas páginas no son el objetivo de este plan.
