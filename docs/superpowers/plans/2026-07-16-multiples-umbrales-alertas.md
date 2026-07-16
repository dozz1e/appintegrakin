# Múltiples umbrales configurables RecordatorioAlert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir varios umbrales de aviso (días/horas/minutos) por usuario en `RecordatorioAlert`, con descarte independiente por umbral.

**Architecture:** Nuevo composable compartido `useUmbralesAlertas.ts` con la lógica de conversión de unidades y cálculo de "tier vigente". `useTareas.ts`/`useCitasCapacitacion.ts` lo consumen para decidir qué mostrar y qué clave de descarte usar. Migración agrega columna `umbral_minutos` a las tablas de descarte existentes, ahora parte de la PK. `ConfiguracionModal.vue` pasa de un input a una lista editable.

**Tech Stack:** Nuxt 4 / Vue 3 / TypeScript, Supabase (Postgres + RLS), Tailwind.

## Global Constraints

- Sin suite de tests automatizada — verificación manual en navegador, la hace el usuario (no el asistente — ver memoria "no probar yo los cambios").
- Sin cambios a `RecordatorioAlert.vue` ni `RecordatorioAlertContainer.vue` (spec, "Fuera de alcance").
- No se permite lista de umbrales vacía — siempre al menos uno.
- Componentes/composables nuevos requieren `rm -rf .nuxt && npm run dev` (gotcha #2 de `CONTEXTO_PROYECTO.md`).
- Campo viejo `settings.umbral_alertas_minutos` no se borra ni se migra, solo se deja de usar.

---

### Task 1: Migración SQL + composable compartido `useUmbralesAlertas.ts`

**Files:**
- Create: `supabase/migrations/20260716030000_umbral_tier_dismiss.sql`
- Create: `app/composables/useUmbralesAlertas.ts`

**Interfaces:**
- Produces (consumido por Tasks 2, 3, 4):
  - `interface UmbralAlerta { valor: number; unidad: 'minutos' | 'horas' | 'dias' }`
  - `const UMBRAL_ALERTA_DEFAULT: UmbralAlerta`
  - `function umbralAMinutos(u: UmbralAlerta): number`
  - `function obtenerUmbralesMinutos(settings: Record<string, unknown> | undefined): number[]`
  - `function calcularTierActual(msRestante: number, umbralesMinutosAsc: number[]): number | null`
  - Columna `umbral_minutos integer` en `tareas_descartadas` y `citas_descartadas`, PK `(user_id, tarea_id, umbral_minutos)` / `(user_id, cita_id, umbral_minutos)`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260716030000_umbral_tier_dismiss.sql
-- Descarte independiente por umbral (antes era por tarea/cita entera):
-- el "tier" es el umbral vigente al momento de descartar (0 = vencida).
-- Ver docs/superpowers/specs/2026-07-16-multiples-umbrales-alertas-design.md

alter table tareas_descartadas add column umbral_minutos integer not null default 0;
alter table tareas_descartadas drop constraint tareas_descartadas_pkey;
alter table tareas_descartadas add primary key (user_id, tarea_id, umbral_minutos);

alter table citas_descartadas add column umbral_minutos integer not null default 0;
alter table citas_descartadas drop constraint citas_descartadas_pkey;
alter table citas_descartadas add primary key (user_id, cita_id, umbral_minutos);
```

- [ ] **Step 2: Aplicar la migración**

Usar la tool `apply_migration` de Supabase (mcp) con `name: umbral_tier_dismiss` y el SQL de arriba, contra el proyecto de este repo.

Expected: sin errores. Verificar con:

```sql
select column_name from information_schema.columns where table_name = 'tareas_descartadas';
select column_name from information_schema.columns where table_name = 'citas_descartadas';
```

Expected: ambas listas incluyen `umbral_minutos`.

- [ ] **Step 3: Crear el composable compartido**

```ts
// app/composables/useUmbralesAlertas.ts
export interface UmbralAlerta {
  valor: number
  unidad: 'minutos' | 'horas' | 'dias'
}

export const UMBRAL_ALERTA_DEFAULT: UmbralAlerta = { valor: 30, unidad: 'minutos' }

export function umbralAMinutos(u: UmbralAlerta): number {
  if (u.unidad === 'dias') return u.valor * 1440
  if (u.unidad === 'horas') return u.valor * 60
  return u.valor
}

// Umbrales configurados por el usuario (o el default), convertidos a
// minutos y ordenados ascendente — el orden importa para
// calcularTierActual.
export function obtenerUmbralesMinutos(settings: Record<string, unknown> | undefined): number[] {
  const config = settings?.umbrales_alertas
  const umbrales = Array.isArray(config) && config.length > 0 ? (config as UmbralAlerta[]) : [UMBRAL_ALERTA_DEFAULT]
  return umbrales.map(umbralAMinutos).sort((a, b) => a - b)
}

// null = todavía no entró en ningún umbral (no se muestra el aviso).
// 0 = ya venció (tier especial, separado de los umbrales configurados).
// Si no venció, el tier es el umbral configurado más chico que ya fue
// cruzado (umbral_minutos >= minutos_restantes) — el más específico/
// urgente vigente en este momento.
export function calcularTierActual(msRestante: number, umbralesMinutosAsc: number[]): number | null {
  if (msRestante <= 0) return 0
  const minutosRestantes = msRestante / 60_000
  return umbralesMinutosAsc.find((u) => u >= minutosRestantes) ?? null
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260716030000_umbral_tier_dismiss.sql app/composables/useUmbralesAlertas.ts
git commit -m "feat: agregar columna umbral_minutos y composable de umbrales de alerta"
```

---

### Task 2: `useTareas.ts` usa umbrales múltiples y descarte por tier

**Files:**
- Modify: `app/composables/useTareas.ts`

**Interfaces:**
- Consumes (de Task 1): `obtenerUmbralesMinutos`, `calcularTierActual`.
- Produces: sin cambios en la forma pública (`tareasProximas`, `refrescarTareasProximas`, `descartarTareaProxima`, `cargarDescartadasGuardadas` mantienen la misma firma externa).

- [ ] **Step 1: Agregar el import y el nuevo estado de tier**

Ubicar la línea `const UMBRAL_MINUTOS_DEFAULT = 30` (línea 14) y **eliminarla**. Agregar en su lugar, junto al resto de imports al tope del archivo:

```ts
import { obtenerUmbralesMinutos, calcularTierActual } from './useUmbralesAlertas'
```

Junto a `const idsTareasDescartadas = useState<Set<string>>(...)` (línea 26), agregar:

```ts
const tierActualTareas = useState<Map<string, number>>('tareas-proximas-tier', () => new Map())
```

- [ ] **Step 2: Reemplazar `refrescarTareasProximas`**

Reemplazar la función completa (líneas 103-130) por:

```ts
async function refrescarTareasProximas(): Promise<void> {
  const { perfil } = useMiPerfil()
  const umbralesMinutos = obtenerUmbralesMinutos(perfil.value?.settings)

  const pendientes = await fetchMisTareasPendientes()
  const ahora = Date.now()
  const nuevoTier = new Map<string, number>()
  tareasProximas.value = pendientes.filter((t) => {
    if (!t.fecha_vencimiento) return false
    const msRestante = new Date(t.fecha_vencimiento).getTime() - ahora
    const tier = calcularTierActual(msRestante, umbralesMinutos)
    if (tier === null) return false
    nuevoTier.set(t.id, tier)
    return !idsTareasDescartadas.value.has(`${t.id}:${tier}`)
  })
  tierActualTareas.value = nuevoTier

  // Poda: si una tarea descartada ya no está pendiente (se completó o
  // se eliminó), se borran todas sus filas de tareas_descartadas (todos
  // los tiers) para no acumular ids muertos.
  const idsPendientes = new Set(pendientes.map((t) => t.id))
  const idsPodados = new Set<string>()
  for (const clave of idsTareasDescartadas.value) {
    const tareaId = clave.split(':')[0]
    if (!idsPendientes.has(tareaId)) {
      idsTareasDescartadas.value.delete(clave)
      idsPodados.add(tareaId)
    }
  }
  if (idsPodados.size > 0 && user.value) {
    await supabase.from('tareas_descartadas').delete().eq('user_id', user.value.sub).in('tarea_id', [...idsPodados])
  }
}
```

- [ ] **Step 3: Reemplazar `descartarTareaProxima`**

Reemplazar la función completa (líneas 135-148) por:

```ts
// Cierre de un alert individual (botón ✕). El descarte es específico
// del tier vigente al momento de cerrar — un umbral más chico que se
// cruce después vuelve a avisar (ver spec de múltiples umbrales).
async function descartarTareaProxima(id: string): Promise<void> {
  const tier = tierActualTareas.value.get(id) ?? 0
  const clave = `${id}:${tier}`
  idsTareasDescartadas.value.add(clave)
  tareasProximas.value = tareasProximas.value.filter((t) => t.id !== id)

  if (!user.value) return
  const { error } = await supabase
    .from('tareas_descartadas')
    .upsert({ user_id: user.value.sub, tarea_id: id, umbral_minutos: tier }, { onConflict: 'user_id,tarea_id,umbral_minutos' })

  if (error) {
    idsTareasDescartadas.value.delete(clave)
    toastError('No se pudo descartar el aviso, intentá de nuevo')
  }
}
```

- [ ] **Step 4: Reemplazar `cargarDescartadasGuardadas`**

Reemplazar la función completa (líneas 152-161) por:

```ts
// Puebla idsTareasDescartadas desde tareas_descartadas. Se llama una vez
// en el onMounted del container, antes del primer refrescar.
async function cargarDescartadasGuardadas(): Promise<void> {
  if (!user.value) return
  const { data, error } = await supabase
    .from('tareas_descartadas')
    .select('tarea_id, umbral_minutos')
    .eq('user_id', user.value.sub)

  if (error) return
  idsTareasDescartadas.value = new Set((data ?? []).map((d) => `${d.tarea_id}:${d.umbral_minutos}`))
}
```

- [ ] **Step 5: Build de verificación**

```bash
rm -rf .nuxt .output && npm run build 2>&1 | tail -30
```

Expected: `✨ Build complete!` sin errores de TypeScript relacionados a `useTareas.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useTareas.ts
git commit -m "feat: usar múltiples umbrales y descarte por tier en useTareas"
```

---

### Task 3: `useCitasCapacitacion.ts` usa umbrales múltiples y descarte por tier

**Files:**
- Modify: `app/composables/useCitasCapacitacion.ts`

**Interfaces:**
- Consumes (de Task 1): `obtenerUmbralesMinutos`, `calcularTierActual`.
- Produces: sin cambios en la forma pública.

- [ ] **Step 1: Agregar el import y el nuevo estado de tier**

Ubicar `const UMBRAL_MINUTOS_DEFAULT = 30` (línea 22) y **eliminarla**. Agregar junto a los imports:

```ts
import { obtenerUmbralesMinutos, calcularTierActual } from './useUmbralesAlertas'
```

Junto a `const idsCitasDescartadas = useState<Set<string>>(...)` (línea 48), agregar:

```ts
const tierActualCitas = useState<Map<string, number>>('citas-proximas-tier', () => new Map())
```

- [ ] **Step 2: Reemplazar `refrescarCitasProximas`**

Reemplazar la función completa (líneas 114-138) por:

```ts
async function refrescarCitasProximas(): Promise<void> {
  const { perfil } = useMiPerfil()
  const umbralesMinutos = obtenerUmbralesMinutos(perfil.value?.settings)

  const pendientes = await fetchMisCitasPendientes()
  const ahora = Date.now()
  const nuevoTier = new Map<string, number>()
  citasProximas.value = pendientes.filter((c) => {
    const msRestante = new Date(c.fecha_hora).getTime() - ahora
    const tier = calcularTierActual(msRestante, umbralesMinutos)
    if (tier === null) return false
    nuevoTier.set(c.id, tier)
    return !idsCitasDescartadas.value.has(`${c.id}:${tier}`)
  })
  tierActualCitas.value = nuevoTier

  const idsPendientes = new Set(pendientes.map((c) => c.id))
  const idsPodados = new Set<string>()
  for (const clave of idsCitasDescartadas.value) {
    const citaId = clave.split(':')[0]
    if (!idsPendientes.has(citaId)) {
      idsCitasDescartadas.value.delete(clave)
      idsPodados.add(citaId)
    }
  }
  if (idsPodados.size > 0 && user.value) {
    await supabase.from('citas_descartadas').delete().eq('user_id', user.value.sub).in('cita_id', [...idsPodados])
  }
}
```

- [ ] **Step 3: Reemplazar `descartarCitaProxima`**

Reemplazar la función completa (líneas 140-155) por:

```ts
async function descartarCitaProxima(id: string): Promise<void> {
  const citaDescartada = citasProximas.value.find((c) => c.id === id)
  const tier = tierActualCitas.value.get(id) ?? 0
  const clave = `${id}:${tier}`
  idsCitasDescartadas.value.add(clave)
  citasProximas.value = citasProximas.value.filter((c) => c.id !== id)

  if (!user.value) return
  const { error } = await supabase
    .from('citas_descartadas')
    .upsert({ user_id: user.value.sub, cita_id: id, umbral_minutos: tier }, { onConflict: 'user_id,cita_id,umbral_minutos' })

  if (error) {
    idsCitasDescartadas.value.delete(clave)
    if (citaDescartada) citasProximas.value = [...citasProximas.value, citaDescartada]
    toastError('No se pudo descartar el aviso, intenta de nuevo')
  }
}
```

- [ ] **Step 4: Reemplazar `cargarDescartadasGuardadas`**

Reemplazar la función completa (líneas 157-166) por:

```ts
async function cargarDescartadasGuardadas(): Promise<void> {
  if (!user.value) return
  const { data, error } = await supabase
    .from('citas_descartadas')
    .select('cita_id, umbral_minutos')
    .eq('user_id', user.value.sub)

  if (error) return
  idsCitasDescartadas.value = new Set((data ?? []).map((d) => `${d.cita_id}:${d.umbral_minutos}`))
}
```

- [ ] **Step 5: Build de verificación**

```bash
rm -rf .nuxt .output && npm run build 2>&1 | tail -30
```

Expected: `✨ Build complete!`.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useCitasCapacitacion.ts
git commit -m "feat: usar múltiples umbrales y descarte por tier en useCitasCapacitacion"
```

---

### Task 4: `ConfiguracionModal.vue` — lista editable de umbrales

**Files:**
- Modify: `app/components/shared/ConfiguracionModal.vue`

**Interfaces:**
- Consumes (de Task 1): `UmbralAlerta`, `UMBRAL_ALERTA_DEFAULT`.
- Consumes (ya existente): `useMiPerfil().actualizarConfiguracion(patch: Record<string, unknown>)`.

- [ ] **Step 1: Reemplazar el estado `umbralMinutos` por `umbrales`**

Reemplazar la línea `const umbralMinutos = ref(30)` (línea 9) por:

```ts
const umbrales = ref<UmbralAlerta[]>([{ ...UMBRAL_ALERTA_DEFAULT }])
```

Y agregar el import junto al resto de composables usados (no hace falta import explícito de `UmbralAlerta`/`UMBRAL_ALERTA_DEFAULT` si Nuxt auto-importa composables — confirmar en Step 4 con el build; si el build falla por tipo/valor no encontrado, agregar `import type { UmbralAlerta } from '~/composables/useUmbralesAlertas'` y `import { UMBRAL_ALERTA_DEFAULT } from '~/composables/useUmbralesAlertas'` al tope del `<script setup>`).

- [ ] **Step 2: Reemplazar la carga en el `watch` y agregar agregar/quitar**

Reemplazar estas dos líneas dentro del `watch` (líneas 21-22):

```ts
    const valor = perfil.value?.settings?.umbral_alertas_minutos
    umbralMinutos.value = typeof valor === 'number' ? valor : 30
```

por:

```ts
    const config = perfil.value?.settings?.umbrales_alertas
    umbrales.value = Array.isArray(config) && config.length > 0
      ? structuredClone(config as UmbralAlerta[])
      : [{ ...UMBRAL_ALERTA_DEFAULT }]
```

Agregar, después del `watch`, dos funciones nuevas:

```ts
function agregarUmbral() {
  umbrales.value.push({ valor: 15, unidad: 'minutos' })
}
function quitarUmbral(i: number) {
  if (umbrales.value.length > 1) umbrales.value.splice(i, 1)
}
```

- [ ] **Step 3: Actualizar `onGuardar`**

Reemplazar la línea `if (umbralMinutos.value < 1) return` (línea 34) por:

```ts
  if (umbrales.value.some((u) => u.valor < 1)) return
```

Reemplazar la línea `await actualizarConfiguracion({ umbral_alertas_minutos: umbralMinutos.value })` (línea 39) por:

```ts
    await actualizarConfiguracion({ umbrales_alertas: umbrales.value })
```

- [ ] **Step 4: Reemplazar el bloque del template**

Reemplazar este bloque (líneas 59-69):

```html
    <div>
      <label class="block text-xs font-medium text-ink-muted mb-1">
        Avisar tareas próximas a vencer con cuántos minutos de anticipación
      </label>
      <input
        v-model.number="umbralMinutos"
        type="number"
        min="1"
        class="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
      />
    </div>
```

por:

```html
    <div>
      <label class="block text-xs font-medium text-ink-muted mb-1">
        Avisar tareas y citas próximas a vencer con esta anticipación
      </label>
      <div v-for="(u, i) in umbrales" :key="i" class="flex items-center gap-2 mb-2">
        <input
          v-model.number="u.valor"
          type="number"
          min="1"
          class="w-20 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        />
        <select
          v-model="u.unidad"
          class="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring"
        >
          <option value="minutos">Minutos</option>
          <option value="horas">Horas</option>
          <option value="dias">Días</option>
        </select>
        <button
          type="button"
          :disabled="umbrales.length === 1"
          class="text-ink-muted hover:text-danger-text disabled:opacity-30 disabled:cursor-not-allowed px-1"
          @click="quitarUmbral(i)"
        >
          ✕
        </button>
      </div>
      <button
        type="button"
        class="text-sm text-primary hover:underline"
        @click="agregarUmbral"
      >
        + Agregar umbral
      </button>
    </div>
```

- [ ] **Step 5: Build de verificación**

```bash
rm -rf .nuxt .output && npm run build 2>&1 | tail -30
```

Expected: `✨ Build complete!`.

- [ ] **Step 6: Commit**

```bash
git add app/components/shared/ConfiguracionModal.vue
git commit -m "feat: lista editable de umbrales de alerta en Configuración"
```

---

### Task 5: Verificación manual end-to-end (la hace el usuario)

**Files:** ninguno (solo verificación en navegador, no la ejecuta el asistente — ver memoria "no probar yo los cambios").

- [ ] **Step 1: Levantar dev server**

```bash
rm -rf .nuxt && npm run dev
```

- [ ] **Step 2: Pedir al usuario que siga los 8 pasos de "Testing (manual)" de la spec**

Ver `docs/superpowers/specs/2026-07-16-multiples-umbrales-alertas-design.md`, sección "Testing (manual, sin suite automatizada)", pasos 1-8. En particular confirmar:
- Se pueden agregar/quitar umbrales en Configuración, no se puede dejar la lista vacía.
- Descartar un aviso a un umbral no apaga el aviso cuando se cruza un umbral más chico después.
- Un usuario que nunca tocó Configuración sigue viendo el aviso a 30 min (comportamiento actual, sin cambios).

- [ ] **Step 3: Confirmar con el usuario que todo funcionó antes de dar la feature por cerrada**

No marcar esta task como completada hasta recibir confirmación explícita del usuario.
