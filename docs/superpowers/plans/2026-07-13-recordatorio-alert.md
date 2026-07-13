# Alert de tarea próxima a vencer — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar un alert cerrable, visible en cualquier página, cuando una tarea propia (`useTareas.ts`) está a 30 minutos o menos de su `fecha_vencimiento`.

**Architecture:** `useTareas.ts` gana estado global (`useState`, mismo patrón que `useToast.ts`) con las tareas próximas a vencer y un set de ids descartados en memoria. Un componente contenedor nuevo (`RecordatorioAlertContainer.vue`), montado una sola vez en `default.vue`, hace polling cada 60s sobre ese estado y apila un `RecordatorioAlert.vue` (presentacional) por tarea, igual que `ToastContainer.vue` apila toasts.

**Tech Stack:** Nuxt 4 / Vue 3 `<script setup>` con TypeScript, `useState` para estado compartido sin props, Tailwind con los tokens semánticos ya extendidos en `tailwind.config.ts` (`bg-warning-bg`, `text-warning-text`).

## Global Constraints

- Sin suite de tests automatizada (`package.json` no tiene script `test`) — la verificación de cada tarea es `npm run build` más verificación manual descrita en cada tarea.
- Componentes nuevos requieren `rm -rf .nuxt` antes de `npm run dev` para que el auto-import los detecte.
- Nunca usar `git commit --no-verify` ni saltar hooks.
- Import de tipos con `import type { X } from '~/composables/useX'` (patrón ya usado en todo el repo).
- No se instala daisyUI — el look de alert se replica con Tailwind + los tokens `warning` ya definidos en `tailwind.config.ts`/`main.css`.
- Umbral fijo en código: 30 minutos (`UMBRAL_MINUTOS_PROXIMAS`), no configurable por el usuario.
- El descarte de un alert (botón ✕) vive solo en memoria (`useState`, no `localStorage`) — vuelve a aparecer si se recarga la página y la tarea sigue dentro de la ventana de 30 min.
- No se toca el cron de Supabase, la tabla `notificaciones`, ni `TareaList.vue` — ver `docs/superpowers/specs/2026-07-13-recordatorio-alert-design.md`, sección "Fuera de alcance".

---

### Task 1: Estado y polling de tareas próximas en `useTareas.ts`

**Files:**
- Modify: `app/composables/useTareas.ts`

**Interfaces:**
- Consumes: `Tarea` interface ya definida en el mismo archivo (líneas 1-12), `fetchMisTareasPendientes()` ya existente (líneas 32-41).
- Produces: `tareasProximas: Ref<Tarea[]>`, `refrescarTareasProximas(): Promise<void>`, `descartarTareaProxima(id: string): void`, agregados al objeto de retorno de `useTareas()`. Task 3 los consume como `const { tareasProximas, refrescarTareasProximas, descartarTareaProxima } = useTareas()`.

- [ ] **Step 1: Agregar el estado y las funciones nuevas**

El archivo completo actual es:

```ts
export interface Tarea {
  id: string
  entidad_tipo: 'lead' | 'cliente' | 'ticket'
  entidad_id: string
  titulo: string
  fecha_vencimiento: string | null
  completada: boolean
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export function useTareas() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { error: toastError } = useToast()

  async function fetchTareasPorEntidad(entidadTipo: Tarea['entidad_tipo'], entidadId: string): Promise<Tarea[]> {
    const { data, error } = await supabase
      .from('tareas')
      .select('*')
      .eq('entidad_tipo', entidadTipo)
      .eq('entidad_id', entidadId)
      .order('completada', { ascending: true })
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })

    if (error) throw error
    return data ?? []
  }

  async function fetchMisTareasPendientes(): Promise<Tarea[]> {
    const { data, error } = await supabase
      .from('tareas')
      .select('*')
      .eq('completada', false)
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })

    if (error) throw error
    return data ?? []
  }

  async function crearTarea(
    entidadTipo: Tarea['entidad_tipo'],
    entidadId: string,
    titulo: string,
    fechaVencimiento: string | null
  ): Promise<Tarea> {
    const { data, error } = await supabase
      .from('tareas')
      .insert({
        entidad_tipo: entidadTipo,
        entidad_id: entidadId,
        titulo,
        fecha_vencimiento: fechaVencimiento,
        owner_id: user.value?.sub,
        created_by: user.value?.sub,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function marcarCompletada(tareaId: string, completada: boolean): Promise<Tarea> {
    const { data, error } = await supabase
      .from('tareas')
      .update({ completada, updated_at: new Date().toISOString() })
      .eq('id', tareaId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  return { fetchTareasPorEntidad, fetchMisTareasPendientes, crearTarea, marcarCompletada }
}
```

Reemplazar el archivo completo por:

```ts
export interface Tarea {
  id: string
  entidad_tipo: 'lead' | 'cliente' | 'ticket'
  entidad_id: string
  titulo: string
  fecha_vencimiento: string | null
  completada: boolean
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

const UMBRAL_MINUTOS_PROXIMAS = 30

export function useTareas() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { error: toastError } = useToast()

  // Estado compartido para el alert global de "tarea próxima a vencer"
  // (RecordatorioAlertContainer.vue) - mismo patrón que useToast.ts.
  const tareasProximas = useState<Tarea[]>('tareas-proximas', () => [])
  const idsTareasDescartadas = useState<Set<string>>('tareas-proximas-descartadas', () => new Set())

  async function fetchTareasPorEntidad(entidadTipo: Tarea['entidad_tipo'], entidadId: string): Promise<Tarea[]> {
    const { data, error } = await supabase
      .from('tareas')
      .select('*')
      .eq('entidad_tipo', entidadTipo)
      .eq('entidad_id', entidadId)
      .order('completada', { ascending: true })
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })

    if (error) throw error
    return data ?? []
  }

  async function fetchMisTareasPendientes(): Promise<Tarea[]> {
    const { data, error } = await supabase
      .from('tareas')
      .select('*')
      .eq('completada', false)
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })

    if (error) throw error
    return data ?? []
  }

  async function crearTarea(
    entidadTipo: Tarea['entidad_tipo'],
    entidadId: string,
    titulo: string,
    fechaVencimiento: string | null
  ): Promise<Tarea> {
    const { data, error } = await supabase
      .from('tareas')
      .insert({
        entidad_tipo: entidadTipo,
        entidad_id: entidadId,
        titulo,
        fecha_vencimiento: fechaVencimiento,
        owner_id: user.value?.sub,
        created_by: user.value?.sub,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function marcarCompletada(tareaId: string, completada: boolean): Promise<Tarea> {
    const { data, error } = await supabase
      .from('tareas')
      .update({ completada, updated_at: new Date().toISOString() })
      .eq('id', tareaId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Recalcula tareasProximas a partir de fetchMisTareasPendientes: tareas no
  // completadas, con fecha_vencimiento futura pero a UMBRAL_MINUTOS_PROXIMAS
  // o menos, excluyendo las que el usuario ya cerró (idsTareasDescartadas).
  async function refrescarTareasProximas(): Promise<void> {
    const pendientes = await fetchMisTareasPendientes()
    const ahora = Date.now()
    tareasProximas.value = pendientes.filter((t) => {
      if (!t.fecha_vencimiento || idsTareasDescartadas.value.has(t.id)) return false
      const msRestante = new Date(t.fecha_vencimiento).getTime() - ahora
      return msRestante > 0 && msRestante <= UMBRAL_MINUTOS_PROXIMAS * 60_000
    })
  }

  // Cierre de un alert individual (botón ✕). Solo en memoria - se resetea al
  // recargar la página, ver Global Constraints del plan.
  function descartarTareaProxima(id: string): void {
    idsTareasDescartadas.value.add(id)
    tareasProximas.value = tareasProximas.value.filter((t) => t.id !== id)
  }

  return {
    fetchTareasPorEntidad,
    fetchMisTareasPendientes,
    crearTarea,
    marcarCompletada,
    tareasProximas,
    refrescarTareasProximas,
    descartarTareaProxima,
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: termina sin errores (exit code 0). Si aparece un error de tipos, revisar que `UMBRAL_MINUTOS_PROXIMAS` quedó fuera de `useTareas()` (a nivel de módulo, no dentro de la función) y que las tres funciones nuevas están dentro de `useTareas()`, antes del `return`.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useTareas.ts
git commit -m "$(cat <<'EOF'
Agregar estado y polling de tareas próximas a useTareas

tareasProximas/refrescarTareasProximas/descartarTareaProxima para el
alert global de tarea a punto de vencer - ver
docs/superpowers/specs/2026-07-13-recordatorio-alert-design.md
EOF
)"
```

---

### Task 2: Componente presentacional `RecordatorioAlert.vue`

**Files:**
- Create: `app/components/shared/RecordatorioAlert.vue`

**Interfaces:**
- Consumes: `Tarea` type desde `~/composables/useTareas` (Task 1).
- Produces: componente Vue, auto-importado por Nuxt como `<SharedRecordatorioAlert>` (patrón `components/shared/X.vue` → `<SharedX>`, igual que `SharedToastContainer`). Props: `tarea: Tarea`. Emits: `cerrar: []`, `click: []`. Task 3 lo consume así: `<SharedRecordatorioAlert :tarea="t" @cerrar="..." @click="..." />`.

- [ ] **Step 1: Crear el componente**

Crear `app/components/shared/RecordatorioAlert.vue` con este contenido completo:

```vue
<script setup lang="ts">
import type { Tarea } from '~/composables/useTareas'

defineProps<{ tarea: Tarea }>()
defineEmits<{ cerrar: []; click: [] }>()

// La ventana de aviso es de 30 min (ver useTareas.ts, UMBRAL_MINUTOS_PROXIMAS),
// así que en la práctica siempre cae en la rama de minutos - la rama de horas
// queda como respaldo si el umbral cambia en el futuro.
function formatearHora(fechaVencimiento: string): string {
  const msRestante = new Date(fechaVencimiento).getTime() - Date.now()
  const minutos = Math.max(1, Math.round(msRestante / 60_000))
  if (minutos < 60) return `en ${minutos} min`
  const horas = Math.round(minutos / 60)
  return `en ${horas} hora${horas === 1 ? '' : 's'}`
}
</script>

<template>
  <div
    class="border-l-4 border-warning-text rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 text-sm bg-warning-bg text-warning-text"
  >
    <span class="text-base shrink-0">⏰</span>
    <div class="flex-1 min-w-0 cursor-pointer" @click="$emit('click')">
      <p class="font-medium truncate">{{ tarea.titulo }}</p>
      <p v-if="tarea.fecha_vencimiento" class="text-xs opacity-80">
        Vence {{ formatearHora(tarea.fecha_vencimiento) }}
      </p>
    </div>
    <button class="opacity-60 hover:opacity-100 shrink-0" @click="$emit('cerrar')">✕</button>
  </div>
</template>
```

- [ ] **Step 2: Verificar que compila**

Run: `rm -rf .nuxt && npm run build`
Expected: termina sin errores. Si Nuxt no reconoce `<SharedRecordatorioAlert>` más adelante (Task 3), confirmar que el archivo quedó en `app/components/shared/RecordatorioAlert.vue` exactamente.

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/RecordatorioAlert.vue
git commit -m "$(cat <<'EOF'
Agregar componente RecordatorioAlert

Alert presentacional para una tarea próxima a vencer (borde/fondo con
tokens warning, cerrable) - ver
docs/superpowers/specs/2026-07-13-recordatorio-alert-design.md
EOF
)"
```

---

### Task 3: Contenedor `RecordatorioAlertContainer.vue` con polling

**Files:**
- Create: `app/components/shared/RecordatorioAlertContainer.vue`

**Interfaces:**
- Consumes: `useTareas().tareasProximas/refrescarTareasProximas/descartarTareaProxima` (Task 1), `<SharedRecordatorioAlert>` (Task 2), `Tarea` type desde `~/composables/useTareas`.
- Produces: componente Vue, auto-importado como `<SharedRecordatorioAlertContainer>`. Sin props ni emits (mismo patrón que `<SharedToastContainer>` y `<SharedNotificationBell>`, que se auto-alimentan de su composable). Task 4 lo monta sin argumentos.

- [ ] **Step 1: Crear el componente**

Crear `app/components/shared/RecordatorioAlertContainer.vue` con este contenido completo:

```vue
<script setup lang="ts">
import type { Tarea } from '~/composables/useTareas'

const { tareasProximas, refrescarTareasProximas, descartarTareaProxima } = useTareas()
const router = useRouter()

let intervalo: ReturnType<typeof setInterval> | null = null

const rutaEntidad: Record<Tarea['entidad_tipo'], string> = {
  lead: '/leads',
  cliente: '/clientes',
  ticket: '/tickets',
}

function onClickTarea(tarea: Tarea) {
  router.push(`${rutaEntidad[tarea.entidad_tipo]}/${tarea.entidad_id}`)
}

onMounted(() => {
  refrescarTareasProximas()
  intervalo = setInterval(refrescarTareasProximas, 60_000)
})

onUnmounted(() => {
  if (intervalo) clearInterval(intervalo)
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-20 right-4 z-50 space-y-2 w-80">
      <TransitionGroup name="recordatorio">
        <SharedRecordatorioAlert
          v-for="t in tareasProximas"
          :key="t.id"
          :tarea="t"
          @cerrar="descartarTareaProxima(t.id)"
          @click="onClickTarea(t)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.recordatorio-enter-active,
.recordatorio-leave-active {
  transition: all 0.2s ease;
}
.recordatorio-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.recordatorio-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
```

`top-20` (5rem) queda debajo del topbar de `h-16` (4rem) con margen, mismo lado (`right-4`) que `ToastContainer` pero arriba, para no superponerse si ambos aparecen a la vez.

- [ ] **Step 2: Verificar que compila**

Run: `rm -rf .nuxt && npm run build`
Expected: termina sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/RecordatorioAlertContainer.vue
git commit -m "$(cat <<'EOF'
Agregar RecordatorioAlertContainer con polling de tareas próximas

Contenedor que apila SharedRecordatorioAlert por cada tarea próxima a
vencer, con polling cada 60s vía refrescarTareasProximas - ver
docs/superpowers/specs/2026-07-13-recordatorio-alert-design.md
EOF
)"
```

---

### Task 4: Montar el contenedor en el layout

**Files:**
- Modify: `app/layouts/default.vue`

**Interfaces:**
- Consumes: `<SharedRecordatorioAlertContainer />` (Task 3).
- Produces: nada nuevo — `default.vue` no expone interfaz a otros archivos.

- [ ] **Step 1: Agregar el contenedor junto al de toasts**

En `app/layouts/default.vue`, la línea final del `<template>` es:

```html
    <SharedToastContainer />
  </div>
</template>
```

Reemplazar por:

```html
    <SharedToastContainer />
    <SharedRecordatorioAlertContainer />
  </div>
</template>
```

- [ ] **Step 2: Verificar que compila**

Run: `rm -rf .nuxt && npm run build`
Expected: termina sin errores.

- [ ] **Step 3: Verificación manual end-to-end**

Run: `npm run dev`, iniciar sesión, y verificar cada punto de la sección "Testing" del spec (`docs/superpowers/specs/2026-07-13-recordatorio-alert-design.md`):

1. Crear una tarea (desde `TareaList.vue` en el detalle de un lead/cliente/ticket) con `fecha_vencimiento` 15 minutos en el futuro: dentro del minuto siguiente aparece el alert en la esquina superior derecha, visible en cualquier página de la app (navegar a otra sección para confirmarlo).
2. Crear una tarea con vencimiento en 2 horas: no aparece alert.
3. Cerrar (✕) un alert: desaparece inmediatamente; navegar entre páginas sin recargar confirma que no vuelve a aparecer.
4. Recargar el navegador con esa misma tarea todavía dentro de la ventana de 30 min: el alert vuelve a aparecer.
5. Click en el cuerpo del alert (no en ✕): navega al detalle de la entidad relacionada (`/leads/:id`, `/clientes/:id` o `/tickets/:id` según corresponda).
6. Crear dos tareas próximas a la vez: se apilan verticalmente; cerrar una no afecta la otra.
7. Dejar pasar el vencimiento de una tarea con el alert visible (o editar `fecha_vencimiento` a un valor ya pasado): en el siguiente poll (≤60s) el alert desaparece de esta lista.

Si el entorno donde se ejecuta este plan no tiene forma de autenticarse contra Supabase (por ejemplo, un agente sin sesión de navegador), documentar cuáles de estos 7 puntos se pudieron verificar y pedirle al usuario que confirme el resto manualmente antes de dar la tarea por cerrada.

- [ ] **Step 4: Commit**

```bash
git add app/layouts/default.vue
git commit -m "$(cat <<'EOF'
Montar RecordatorioAlertContainer en el layout

Alert global de tarea próxima a vencer visible en toda la app - ver
docs/superpowers/specs/2026-07-13-recordatorio-alert-design.md
EOF
)"
```

---

## Cierre

Al terminar las 4 tareas, confirmar con `git log --oneline -5` que quedaron los 4 commits (más el del spec ya existente) y avisarle al usuario que confirme el push a `origin/master` (este entorno no tiene credenciales para pushear solo).
