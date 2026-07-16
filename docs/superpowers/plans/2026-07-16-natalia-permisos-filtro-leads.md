# Permiso ventas.view_all Natalia + filtro vendedor Leads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a Natalia Quevedo el permiso `ventas.view_all` (override individual) y agregar un selector de vendedor en la vista de Leads, gateado por `leads.view_all`.

**Architecture:** Parte A es un dato (insert SQL vía Supabase), no código. Parte B replica en `app/pages/leads/index.vue` el patrón client-side ya usado en `app/components/clientes/ClienteSplitView.vue` (filtro por `owner_id`, `usuarios` cargados con `useUsuarios().fetchUsuarios()`, gateado con `can('leads','view_all')`).

**Tech Stack:** Nuxt 4 / Vue 3 / TypeScript, Supabase (Postgres + RLS), Tailwind.

## Global Constraints

- Sin cambios a `useLeads.ts`, `useUsuarios.ts`, `useVentas.ts` ni RLS (spec, sección "Fuera de alcance").
- No crear rol `lider_ventas` — solo override individual (spec, Parte A).
- Sin suite de tests automatizada en este proyecto — verificación es manual, en navegador (ver `CLAUDE.md`/memoria: "no probar yo los cambios" — el usuario prueba él mismo).
- Componentes/composables nuevos requieren `rm -rf .nuxt && npm run dev` (gotcha #2 de `CONTEXTO_PROYECTO.md`) — no aplica acá porque no se crean archivos nuevos, solo se edita `leads/index.vue` existente, pero repetir igual si el dev server no refleja el cambio.

---

### Task 1: Override de permiso ventas.view_all para Natalia

**Files:**
- Ninguno en el repo (dato en Supabase, no migración versionada — es una excepción puntual a un usuario, no un cambio de esquema).

**Interfaces:**
- Consumes: tabla `profiles` (buscar `id` de Natalia por nombre/email), tabla `permissions` (buscar `id` de `resource='ventas', action='view_all'`), tabla `user_permission_overrides(user_id, permission_id, effect, created_by)`.
- Produces: nada que otras tasks consuman — Task 2 es independiente de esta.

- [ ] **Step 1: Ubicar el `id` de Natalia en `profiles`**

Ejecutar vía Supabase (mcp `execute_sql`, proyecto de este repo):

```sql
select id, full_name, email from profiles where full_name ilike '%natalia%' or email ilike '%natalia%';
```

Expected: una sola fila. Si hay más de una o ninguna, parar y confirmar con el usuario el email/nombre exacto antes de seguir.

- [ ] **Step 2: Ubicar el `id` del permiso ventas.view_all**

```sql
select id from permissions where resource = 'ventas' and action = 'view_all';
```

Expected: una sola fila (permiso ya existe, seed de `20260713000500_ventas_permisos.sql`).

- [ ] **Step 3: Verificar que no exista ya un override para ese par usuario/permiso**

```sql
select * from user_permission_overrides
where user_id = '<id_natalia_step1>' and permission_id = '<id_permiso_step2>';
```

Expected: 0 filas. Si ya existe una fila con `effect = 'grant'`, no hacer nada más (ya está resuelto) y saltar a Task 2. Si existe con `effect = 'revoke'`, confirmar con el usuario antes de tocarla (alguien la revocó a propósito).

- [ ] **Step 4: Insertar el override**

```sql
insert into user_permission_overrides (user_id, permission_id, effect)
values ('<id_natalia_step1>', '<id_permiso_step2>', 'grant');
```

Expected: `INSERT 0 1`.

- [ ] **Step 5: Verificar en la app (manual, la hace el usuario)**

Pedir al usuario que Natalia entre a Clientes → pestaña Ventas de un cliente que no sea suyo, y confirme que ahora ve las ventas de otras vendedoras. No lo prueba el asistente (ver Global Constraints).

---

### Task 2: Selector de vendedor en la vista de Leads

**Files:**
- Modify: `app/pages/leads/index.vue`

**Interfaces:**
- Consumes: `useUsuarios().fetchUsuarios(): Promise<Usuario[]>` (ya existe, sin cambios — mismo import que usa `app/pages/clientes/index.vue`), `usePermissions().can(resource: string, action: string): boolean` (ya existe, mismo import que usa `ClienteSplitView.vue`), `Lead.owner_id: string | null` (ya existe en `useLeads.ts`).
- Produces: nada que otra task consuma.

- [ ] **Step 1: Leer el archivo actual completo**

```bash
cat -n app/pages/leads/index.vue
```

Confirmar los nombres exactos de: el `computed` de búsqueda actual (`leadsFiltrados`), el `ref` de búsqueda (`busqueda`), el bloque `<script setup>` de imports, y el bloque del template donde está el `<input>` de búsqueda (según el spec, alrededor de las líneas 25-29 y 98-105, pero confirmar contra el archivo real ya que pudo cambiar).

- [ ] **Step 2: Agregar los imports y el estado de filtro en el `<script setup>`**

Agregar junto a los imports/composables existentes (no reemplazar los que ya están, sumar):

```ts
import type { Usuario } from '~/composables/useUsuarios'

const { can } = usePermissions()
const { fetchUsuarios } = useUsuarios()
const usuarios = ref<Usuario[]>([])
const filtroVendedor = ref('')
```

Nota: si `usePermissions` o `useUsuarios` ya están importados/llamados en el archivo (posible, ya que la página gatea por permiso), no duplicar la llamada — solo agregar lo que falte (`can`, `fetchUsuarios`, `usuarios`, `filtroVendedor`).

- [ ] **Step 3: Cargar usuarios en `onMounted`, junto al fetch de leads existente**

Ubicar el `onMounted` que hace `leads.value = await fetchLeads()` y agregar la carga de usuarios ahí mismo:

```ts
onMounted(async () => {
  leads.value = await fetchLeads()
  usuarios.value = await fetchUsuarios()
})
```

(Si el `onMounted` actual tiene más contenido como `cargando.value = false`, mantenerlo — solo insertar la línea de `fetchUsuarios()`.)

- [ ] **Step 4: Extender el computed `leadsFiltrados` con el filtro de vendedor**

Reemplazar el computed actual:

```ts
const leadsFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return leads.value
  return leads.value.filter((l) => l.nombre.toLowerCase().includes(q))
})
```

por:

```ts
const leadsFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  return leads.value.filter((l) => {
    if (q && !l.nombre.toLowerCase().includes(q)) return false
    if (filtroVendedor.value === 'sin_asignar' && l.owner_id !== null) return false
    if (filtroVendedor.value && filtroVendedor.value !== 'sin_asignar' && l.owner_id !== filtroVendedor.value) return false
    return true
  })
})
```

- [ ] **Step 5: Agregar el `<select>` en el template, junto al input de búsqueda existente**

Ubicar el `<div class="flex flex-wrap gap-2 mb-4">` que contiene el `<input>` de búsqueda y agregar el select justo después del input, dentro del mismo div:

```html
<select
  v-if="can('leads', 'view_all')"
  v-model="filtroVendedor"
  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
>
  <option value="">Todos los vendedores</option>
  <option value="sin_asignar">Sin asignar</option>
  <option v-for="u in usuarios" :key="u.id" :value="u.id">{{ u.full_name || u.email }}</option>
</select>
```

- [ ] **Step 6: Levantar el dev server y verificar en el navegador**

```bash
rm -rf .nuxt && npm run dev
```

Navegar a `/leads`. Verificar:
- Con un usuario que tenga `leads.view_all`: el select aparece, se ven "Todos los vendedores" / "Sin asignar" / lista de vendedoras.
- Elegir un vendedor: solo aparecen sus leads en el Kanban.
- Elegir "Sin asignar": solo leads con `owner_id` nulo.
- Combinar con el buscador de texto: el resultado respeta ambos filtros (AND).
- Volver a "Todos los vendedores": la lista completa vuelve.
- Con un usuario sin `leads.view_all` (ej. rol `ventas` puro): el select no aparece.

- [ ] **Step 7: Commit**

```bash
git add app/pages/leads/index.vue
git commit -m "feat: agregar filtro de vendedor en vista de leads"
```
