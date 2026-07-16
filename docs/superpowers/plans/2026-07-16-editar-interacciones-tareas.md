# Editar interacciones y tareas/recordatorios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar interacciones de clientes/leads (canal + nota) y tareas (título + fecha/hora), cubriendo recordatorios automáticamente (misma tabla `tareas`).

**Architecture:** Edición inline sin modal — cada fila de lista se reemplaza por los mismos inputs del form de "agregar" al tocar el lápiz, con Guardar/Cancelar. Nuevas policies RLS de `update` para interacciones (mismo criterio ya usado en el delete arreglado); tareas no necesita migración, su policy de `update` ya es correcta.

**Tech Stack:** Nuxt 4 / Vue 3 / TypeScript, Supabase (Postgres + RLS), Tailwind.

## Global Constraints

- Sin suite de tests automatizada — verificación manual, la hace el usuario.
- Solo una fila editable a la vez por componente (un solo `ref` de id-en-edición).
- No se edita `completada`/`owner_id` de tareas ni se agrega `updated_at` a interacciones (spec, "Fuera de alcance").
- Componentes/composables nuevos requieren `rm -rf .nuxt && npm run dev` (gotcha #2).

---

### Task 1: Migración RLS — permitir `update` en interacciones

**Files:**
- Create: `supabase/migrations/20260716050000_update_interacciones_permiso.sql`

**Interfaces:**
- Produces: policies `update_interacciones_propias_cliente` en `cliente_interacciones`, `update_interacciones_propias_lead` en `lead_interacciones` — consumidas implícitamente por Task 2 (sin ellas, el `.update()` queda bloqueado en silencio, mismo gotcha #18 del delete).

- [ ] **Step 1: Escribir y aplicar la migración**

```sql
-- supabase/migrations/20260716050000_update_interacciones_permiso.sql
-- Permite editar interacciones (antes solo crear/borrar). Mismo criterio
-- que la policy de delete ya arreglada: creador o clientes.edit/leads.edit.

create policy update_interacciones_propias_cliente
  on cliente_interacciones for update
  using (created_by = auth.uid() or has_permission(auth.uid(), 'clientes', 'edit'));

create policy update_interacciones_propias_lead
  on lead_interacciones for update
  using (created_by = auth.uid() or has_permission(auth.uid(), 'leads', 'edit'));
```

Aplicar con la tool `apply_migration` de Supabase (mcp), `name: update_interacciones_permiso`.

- [ ] **Step 2: Verificar**

```sql
select polname, polcmd from pg_policy where polrelid = 'cliente_interacciones'::regclass;
select polname, polcmd from pg_policy where polrelid = 'lead_interacciones'::regclass;
```

Expected: ambas listas incluyen una fila con `polcmd = 'w'` (update) además de las de select/insert/delete existentes.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260716050000_update_interacciones_permiso.sql
git commit -m "feat: permitir editar interacciones (RLS update)"
```

---

### Task 2: `actualizarInteraccion` en ambos composables

**Files:**
- Modify: `app/composables/useClienteInteracciones.ts`
- Modify: `app/composables/useLeadInteracciones.ts`

**Interfaces:**
- Consumes (de Task 1): policies de `update` ya aplicadas.
- Produces (consumido por Tasks 3 y 4): `actualizarInteraccion(id: string, canal: ClienteInteraccion['canal'] | LeadInteraccion['canal'], nota: string): Promise<ClienteInteraccion | LeadInteraccion>`.

- [ ] **Step 1: Agregar la función en `useClienteInteracciones.ts`**

Agregar después de `agregarInteraccion` (línea 44) y antes de `eliminarInteraccion`:

```ts
  async function actualizarInteraccion(
    id: string,
    canal: ClienteInteraccion['canal'],
    nota: string
  ): Promise<ClienteInteraccion> {
    const { data, error } = await supabase
      .from('cliente_interacciones')
      .update({ canal, nota })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }
```

Agregar `actualizarInteraccion` al `return` del final (línea 68 actual: `return { fetchInteracciones, agregarInteraccion, eliminarInteraccion, fetchUltimasInteracciones }`).

- [ ] **Step 2: Agregar la función espejo en `useLeadInteracciones.ts`**

Agregar después de `agregarInteraccion` (línea 44) y antes de `eliminarInteraccion`:

```ts
  async function actualizarInteraccion(
    id: string,
    canal: LeadInteraccion['canal'],
    nota: string
  ): Promise<LeadInteraccion> {
    const { data, error } = await supabase
      .from('lead_interacciones')
      .update({ canal, nota })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }
```

Agregar `actualizarInteraccion` al `return` final (línea 51 actual: `return { fetchInteracciones, agregarInteraccion, eliminarInteraccion }`).

- [ ] **Step 3: Build de verificación**

```bash
rm -rf .nuxt .output && npm run build 2>&1 | tail -20
```

Expected: `✨ Build complete!`.

- [ ] **Step 4: Commit**

```bash
git add app/composables/useClienteInteracciones.ts app/composables/useLeadInteracciones.ts
git commit -m "feat: agregar actualizarInteraccion a composables de clientes y leads"
```

---

### Task 3: Edición inline en `ClienteInteraccionTimeline.vue`

**Files:**
- Modify: `app/components/clientes/ClienteInteraccionTimeline.vue`

**Interfaces:**
- Consumes (de Task 2): `actualizarInteraccion(id, canal, nota)`.

- [ ] **Step 1: Agregar estado de edición y destructurar `actualizarInteraccion`**

Reemplazar la línea 6 (`const { fetchInteracciones, agregarInteraccion, eliminarInteraccion } = useClienteInteracciones()`) por:

```ts
const { fetchInteracciones, agregarInteraccion, actualizarInteraccion, eliminarInteraccion } = useClienteInteracciones()
```

Agregar junto a `const aEliminar = ref<ClienteInteraccion | null>(null)` (línea 12):

```ts
const idEditando = ref<string | null>(null)
const canalEditado = ref<ClienteInteraccion['canal']>('correo')
const notaEditada = ref('')
const guardandoEdicion = ref(false)
```

- [ ] **Step 2: Agregar funciones de edición**

Agregar después de `onSubmit` (después de línea 49, antes de `formatearFecha`):

```ts
function onEditar(i: ClienteInteraccion) {
  idEditando.value = i.id
  canalEditado.value = i.canal
  notaEditada.value = i.nota
}

function onCancelarEdicion() {
  idEditando.value = null
}

async function onGuardarEdicion(i: ClienteInteraccion) {
  if (!notaEditada.value.trim()) return
  guardandoEdicion.value = true
  try {
    const actualizada = await actualizarInteraccion(i.id, canalEditado.value, notaEditada.value.trim())
    const idx = interacciones.value.findIndex((x) => x.id === i.id)
    if (idx !== -1) interacciones.value[idx] = actualizada
    idEditando.value = null
    success('Interacción actualizada')
  } catch (e) {
    error('No se pudo actualizar la interacción')
  } finally {
    guardandoEdicion.value = false
  }
}
```

- [ ] **Step 3: Agregar botón de editar y el modo edición en el template**

Reemplazar el bloque del `<li>` (líneas 107-130) completo por:

```html
      <li
        v-for="i in interacciones"
        :key="i.id"
        class="flex gap-3 border-l-2 pl-3"
        :class="colorCanal(i.canal).clases.split(' ')[1]?.replace('text-', 'border-')"
      >
        <Icon :name="iconoCanal[i.canal]" class="w-5 h-5 mt-0.5 flex-shrink-0" :class="colorCanal(i.canal).clases.split(' ')[1]" />
        <div v-if="idEditando === i.id" class="flex-1 flex flex-wrap gap-2">
          <select
            v-model="canalEditado"
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="llamada">Llamada</option>
            <option value="web">Web</option>
            <option value="correo">Correo</option>
          </select>
          <input
            v-model="notaEditada"
            type="text"
            class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
            @keyup.enter="onGuardarEdicion(i)"
          />
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="guardandoEdicion || !notaEditada.trim()"
              class="bg-primary hover:bg-primary-hover text-ink-onprimary px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              @click="onGuardarEdicion(i)"
            >
              Guardar
            </button>
            <button
              type="button"
              class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              @click="onCancelarEdicion"
            >
              Cancelar
            </button>
          </div>
        </div>
        <div v-else class="flex-1">
          <div class="flex items-center gap-2">
            <SharedBadge :label="colorCanal(i.canal).label" :clases="colorCanal(i.canal).clases" />
            <span class="text-xs text-gray-400">{{ formatearFecha(i.created_at) }}</span>
          </div>
          <SharedTextoExpandible :texto="i.nota" class="text-sm text-gray-700 mt-1" />
          <SharedGaleriaImagenes entidad-tipo="cliente_interaccion" :entidad-id="i.id" class="mt-2" />
        </div>
        <div v-if="idEditando !== i.id" class="flex gap-1 shrink-0">
          <button
            type="button"
            class="text-gray-300 hover:text-primary transition-colors"
            title="Editar"
            @click="onEditar(i)"
          >
            <Icon name="mdi:pencil-outline" class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="text-gray-300 hover:text-danger transition-colors"
            title="Eliminar"
            @click="aEliminar = i"
          >
            <Icon name="mdi:trash-can-outline" class="w-4 h-4" />
          </button>
        </div>
      </li>
```

- [ ] **Step 4: Build de verificación**

```bash
rm -rf .nuxt .output && npm run build 2>&1 | tail -20
```

Expected: `✨ Build complete!`.

- [ ] **Step 5: Commit**

```bash
git add app/components/clientes/ClienteInteraccionTimeline.vue
git commit -m "feat: edición inline de interacciones de clientes"
```

---

### Task 4: Edición inline en `LeadTimeline.vue`

**Files:**
- Modify: `app/components/leads/LeadTimeline.vue`

**Interfaces:**
- Consumes (de Task 2): `actualizarInteraccion(id, canal, nota)`.

Mismos 3 cambios que Task 3, en espejo, con estas diferencias puntuales:
- Import/tipo: `LeadInteraccion` en vez de `ClienteInteraccion`.
- Línea 5 pasa a: `const { fetchInteracciones, agregarInteraccion, actualizarInteraccion, eliminarInteraccion } = useLeadInteracciones()`.
- El botón editar/guardar/cancelar usa los mismos colores hardcodeados que ya usa este archivo (`#1075B5`/`#0C5D91`) en vez de los tokens `bg-primary` (este archivo todavía no migró a tokens, ver nota de `CONTEXTO_PROYECTO.md` sobre `bg-[#1075B5]` en código viejo no migrado — no es parte de este cambio migrar colores).
- `SharedGaleriaImagenes` usa `entidad-tipo="lead_interaccion"` (ya así, sin cambios).
- No tiene el `emit('registrada')` que sí tiene `ClienteInteraccionTimeline.vue` en su `onSubmit` — no aplica a la edición tampoco, no agregar.

- [ ] **Step 1: Agregar estado de edición y destructurar `actualizarInteraccion`**

Reemplazar línea 5 por:

```ts
const { fetchInteracciones, agregarInteraccion, actualizarInteraccion, eliminarInteraccion } = useLeadInteracciones()
```

Agregar junto a `const aEliminar = ref<LeadInteraccion | null>(null)` (línea 11):

```ts
const idEditando = ref<string | null>(null)
const canalEditado = ref<'whatsapp' | 'instagram' | 'facebook' | 'llamada' | 'web' | 'correo'>('correo')
const notaEditada = ref('')
const guardandoEdicion = ref(false)
```

- [ ] **Step 2: Agregar funciones de edición**

Agregar después de `onSubmit` (después de línea 47, antes de `formatearFecha`):

```ts
function onEditar(i: LeadInteraccion) {
  idEditando.value = i.id
  canalEditado.value = i.canal
  notaEditada.value = i.nota
}

function onCancelarEdicion() {
  idEditando.value = null
}

async function onGuardarEdicion(i: LeadInteraccion) {
  if (!notaEditada.value.trim()) return
  guardandoEdicion.value = true
  try {
    const actualizada = await actualizarInteraccion(i.id, canalEditado.value, notaEditada.value.trim())
    const idx = interacciones.value.findIndex((x) => x.id === i.id)
    if (idx !== -1) interacciones.value[idx] = actualizada
    idEditando.value = null
    success('Interacción actualizada')
  } catch (e) {
    error('No se pudo actualizar la interacción')
  } finally {
    guardandoEdicion.value = false
  }
}
```

- [ ] **Step 3: Agregar botón de editar y el modo edición en el template**

Reemplazar el bloque del `<li>` (líneas 105-128) completo por:

```html
      <li
        v-for="i in interacciones"
        :key="i.id"
        class="flex gap-3 border-l-2 pl-3"
        :class="colorCanal(i.canal).clases.split(' ')[1]?.replace('text-', 'border-')"
      >
        <Icon :name="iconoCanal[i.canal]" class="w-5 h-5 mt-0.5 flex-shrink-0" :class="colorCanal(i.canal).clases.split(' ')[1]" />
        <div v-if="idEditando === i.id" class="flex-1 flex flex-wrap gap-2">
          <select
            v-model="canalEditado"
            class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="llamada">Llamada</option>
            <option value="web">Web</option>
            <option value="correo">Correo</option>
          </select>
          <input
            v-model="notaEditada"
            type="text"
            class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
            @keyup.enter="onGuardarEdicion(i)"
          />
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="guardandoEdicion || !notaEditada.trim()"
              class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              @click="onGuardarEdicion(i)"
            >
              Guardar
            </button>
            <button
              type="button"
              class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              @click="onCancelarEdicion"
            >
              Cancelar
            </button>
          </div>
        </div>
        <div v-else class="flex-1">
          <div class="flex items-center gap-2">
            <SharedBadge :label="colorCanal(i.canal).label" :clases="colorCanal(i.canal).clases" />
            <span class="text-xs text-gray-400">{{ formatearFecha(i.created_at) }}</span>
          </div>
          <SharedTextoExpandible :texto="i.nota" class="text-sm text-gray-700 mt-1" />
          <SharedGaleriaImagenes entidad-tipo="lead_interaccion" :entidad-id="i.id" class="mt-2" />
        </div>
        <div v-if="idEditando !== i.id" class="flex gap-1 shrink-0">
          <button
            type="button"
            class="text-gray-300 hover:text-[#1075B5] transition-colors"
            title="Editar"
            @click="onEditar(i)"
          >
            <Icon name="mdi:pencil-outline" class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="text-gray-300 hover:text-danger transition-colors"
            title="Eliminar"
            @click="aEliminar = i"
          >
            <Icon name="mdi:trash-can-outline" class="w-4 h-4" />
          </button>
        </div>
      </li>
```

- [ ] **Step 4: Build de verificación**

```bash
rm -rf .nuxt .output && npm run build 2>&1 | tail -20
```

Expected: `✨ Build complete!`.

- [ ] **Step 5: Commit**

```bash
git add app/components/leads/LeadTimeline.vue
git commit -m "feat: edición inline de interacciones de leads"
```

---

### Task 5: `actualizarTarea` en `useTareas.ts`

**Files:**
- Modify: `app/composables/useTareas.ts`

**Interfaces:**
- Produces (consumido por Task 6): `actualizarTarea(id: string, titulo: string, fechaVencimiento: string | null): Promise<Tarea>`.

- [ ] **Step 1: Agregar la función**

Agregar después de `marcarCompletada` (después de línea 92, antes de `eliminarTarea`):

```ts
  async function actualizarTarea(id: string, titulo: string, fechaVencimiento: string | null): Promise<Tarea> {
    const { data, error } = await supabase
      .from('tareas')
      .update({ titulo, fecha_vencimiento: fechaVencimiento, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }
```

- [ ] **Step 2: Agregar al `return`**

Ubicar el `return` final del composable (`return { fetchTareasPorEntidad, fetchMisTareasPendientes, crearTarea, marcarCompletada, eliminarTarea, tareasProximas, refrescarTareasProximas, descartarTareaProxima, cargarDescartadasGuardadas }`) y agregar `actualizarTarea` junto a `marcarCompletada`.

- [ ] **Step 3: Build de verificación**

```bash
rm -rf .nuxt .output && npm run build 2>&1 | tail -20
```

Expected: `✨ Build complete!`.

- [ ] **Step 4: Commit**

```bash
git add app/composables/useTareas.ts
git commit -m "feat: agregar actualizarTarea a useTareas"
```

---

### Task 6: Edición inline en `TareaList.vue`

**Files:**
- Modify: `app/components/shared/TareaList.vue`

**Interfaces:**
- Consumes (de Task 5): `actualizarTarea(id, titulo, fechaVencimiento)`.

- [ ] **Step 1: Destructurar `actualizarTarea` y agregar estado de edición**

Reemplazar línea 9 (`const { fetchTareasPorEntidad, crearTarea, marcarCompletada, eliminarTarea } = useTareas()`) por:

```ts
const { fetchTareasPorEntidad, crearTarea, marcarCompletada, actualizarTarea, eliminarTarea } = useTareas()
```

Agregar junto a `const aEliminar = ref<Tarea | null>(null)` (línea 15):

```ts
const idEditando = ref<string | null>(null)
const tituloEditado = ref('')
const fechaEditada = ref('')
const horaEditada = ref('')
const guardandoEdicion = ref(false)
```

- [ ] **Step 2: Agregar funciones de edición**

Agregar después de `onToggle` (después de línea 68, antes de `onConfirmarEliminar`):

```ts
function aFechaInput(fechaIso: string | null): string {
  if (!fechaIso) return ''
  const d = new Date(fechaIso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function aHoraInput(fechaIso: string | null): string {
  if (!fechaIso) return ''
  const d = new Date(fechaIso)
  const esDefault = d.getHours() === 23 && d.getMinutes() === 59
  if (esDefault) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function onEditar(tarea: Tarea) {
  idEditando.value = tarea.id
  tituloEditado.value = tarea.titulo
  fechaEditada.value = aFechaInput(tarea.fecha_vencimiento)
  horaEditada.value = aHoraInput(tarea.fecha_vencimiento)
}

function onCancelarEdicion() {
  idEditando.value = null
}

async function onGuardarEdicion(tarea: Tarea) {
  if (!tituloEditado.value.trim()) return
  guardandoEdicion.value = true
  try {
    const actualizada = await actualizarTarea(
      tarea.id,
      tituloEditado.value.trim(),
      fechaEditada.value ? construirFechaVencimiento(fechaEditada.value, horaEditada.value) : null
    )
    const idx = tareas.value.findIndex((t) => t.id === tarea.id)
    if (idx !== -1) tareas.value[idx] = actualizada
    idEditando.value = null
    success('Tarea actualizada')
  } catch (e) {
    error('No se pudo actualizar la tarea')
  } finally {
    guardandoEdicion.value = false
  }
}
```

`aFechaInput`/`aHoraInput` son las mismas funciones ya usadas en
`CitaForm.vue` (mismo patrón exacto, ver
`app/components/capacitaciones/CitaForm.vue:17-28`) — se replican acá
porque `TareaList.vue` no las tenía (solo creaba, nunca necesitó
pre-llenar un form).

- [ ] **Step 3: Agregar botón de editar y el modo edición en el template**

Reemplazar el bloque del `<li>` (líneas 135-163) completo por:

```html
      <li
        v-for="t in tareas"
        :key="t.id"
        class="flex items-start gap-3 p-2 rounded-lg"
        :class="esVencida(t) ? 'bg-red-50' : 'bg-gray-50'"
      >
        <input
          v-if="idEditando !== t.id"
          type="checkbox"
          :checked="t.completada"
          class="w-4 h-4 accent-[#1075B5] mt-0.5"
          @change="onToggle(t)"
        />
        <div v-if="idEditando === t.id" class="flex-1 space-y-2">
          <input
            v-model="tituloEditado"
            type="text"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
            @keyup.enter="onGuardarEdicion(t)"
          />
          <div class="flex flex-wrap gap-2">
            <input
              v-model="fechaEditada"
              type="date"
              class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
              @click="abrirPicker"
            />
            <input
              v-model="horaEditada"
              type="time"
              class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30"
              @click="abrirPicker"
            />
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="guardandoEdicion || !tituloEditado.trim()"
              class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              @click="onGuardarEdicion(t)"
            >
              Guardar
            </button>
            <button
              type="button"
              class="border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              @click="onCancelarEdicion"
            >
              Cancelar
            </button>
          </div>
        </div>
        <template v-else>
          <SharedTextoExpandible
            :texto="t.titulo"
            class="flex-1 min-w-0 text-sm"
            :class="t.completada ? 'line-through text-gray-400' : 'text-gray-700'"
          />
          <span v-if="t.fecha_vencimiento" class="text-xs shrink-0" :class="esVencida(t) ? 'text-red-600 font-medium' : 'text-gray-400'">
            {{ formatearFecha(t.fecha_vencimiento) }}
          </span>
        </template>
        <div v-if="idEditando !== t.id" class="flex gap-1 shrink-0">
          <button
            type="button"
            class="text-gray-300 hover:text-[#1075B5] transition-colors"
            title="Editar"
            @click="onEditar(t)"
          >
            <Icon name="mdi:pencil-outline" class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="text-gray-300 hover:text-red-600 transition-colors"
            title="Eliminar"
            @click="aEliminar = t"
          >
            <Icon name="mdi:trash-can-outline" class="w-4 h-4" />
          </button>
        </div>
      </li>
```

- [ ] **Step 4: Build de verificación**

```bash
rm -rf .nuxt .output && npm run build 2>&1 | tail -20
```

Expected: `✨ Build complete!`.

- [ ] **Step 5: Commit**

```bash
git add app/components/shared/TareaList.vue
git commit -m "feat: edición inline de tareas y recordatorios"
```

---

### Task 7: Verificación manual end-to-end (la hace el usuario)

**Files:** ninguno.

- [ ] **Step 1: Levantar dev server**

```bash
rm -rf .nuxt && npm run dev
```

- [ ] **Step 2: Seguir los 7 pasos de "Testing (manual)" de la spec**

Ver `docs/superpowers/specs/2026-07-16-editar-interacciones-tareas-design.md`,
sección "Testing (manual, sin suite automatizada)".

- [ ] **Step 3: Confirmar con el usuario antes de cerrar la task**

No marcar como completada hasta recibir confirmación explícita.
