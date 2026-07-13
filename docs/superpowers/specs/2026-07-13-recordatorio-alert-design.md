# Alert de tarea próxima a vencer

## Contexto

`useTareas.ts` ya modela tareas/recordatorios con `fecha_vencimiento`.
Hoy solo existen dos avisos:

- **`TareaList.vue`**: resalta en rojo (`esVencida()`) tareas ya
  vencidas, pero solo dentro del detalle de la entidad (lead/cliente/
  ticket) donde vive la tarea.
- **`NotificationBell.vue`** + tabla `notificaciones`: un cron de
  Supabase (`20260710000000_notificacion_tarea_vencida.sql`) corre
  cada hora y crea una notificación tipo `tarea_vencida` (⏰) cuando
  una tarea ya venció.

No existe ningún aviso **anticipado** (antes de vencer) ni ningún
aviso **global** (visible fuera del detalle de la entidad). Se pide
agregar un alert cerrable, visible en cualquier página, que avise
cuando falta poco para que una tarea propia venza.

`fetchMisTareasPendientes()` en `useTareas.ts` ya existe y trae todas
las tareas no completadas del usuario, pero no se usa en ningún
componente — es el punto de entrada natural para esto.

daisyUI (referencia visual pedida por el usuario) **no está instalado**
en el proyecto (solo `@nuxtjs/tailwindcss`, confirmado en
`package.json`/`nuxt.config.ts`). Se replica el look de un alert
daisyUI (borde de color + ícono + texto + botón cerrar) con Tailwind
puro y los tokens semánticos ya definidos en `main.css`
(`--color-warning-bg`, `--color-warning-text`), que hoy no se usan en
ningún componente.

## Diseño

### `useTareas.ts` — polling de tareas próximas

Se agrega al composable:

```ts
const tareasProximas = useState<Tarea[]>('tareas-proximas', () => [])
const idsDescartados = useState<Set<string>>('tareas-proximas-descartadas', () => new Set())

const UMBRAL_MINUTOS = 30

async function refrescarTareasProximas() {
  const pendientes = await fetchMisTareasPendientes()
  const ahora = Date.now()
  tareasProximas.value = pendientes.filter((t) => {
    if (!t.fecha_vencimiento || idsDescartados.value.has(t.id)) return false
    const msRestante = new Date(t.fecha_vencimiento).getTime() - ahora
    return msRestante > 0 && msRestante <= UMBRAL_MINUTOS * 60_000
  })
}

function descartarTareaProxima(id: string) {
  idsDescartados.value.add(id)
  tareasProximas.value = tareasProximas.value.filter((t) => t.id !== id)
}
```

Estado vía `useState` (mismo patrón que `useToast.ts`) — compartido
entre componentes sin props. `idsDescartados` vive solo en memoria del
tab (no `localStorage`): al recargar la página se vuelve a evaluar
desde cero, tal como se acordó (una tarea cerrada puede reaparecer si
se recarga).

Se agregan `tareasProximas`, `refrescarTareasProximas`,
`descartarTareaProxima` al return del composable.

### Polling — dónde vive el `setInterval`

Vive en el nuevo componente contenedor (no dentro del composable), 
mismo patrón que `NotificationBell.vue` maneja su propia suscripción
en `onMounted`/`onUnmounted`:

```ts
onMounted(() => {
  refrescarTareasProximas()
  intervalo = setInterval(refrescarTareasProximas, 60_000)
})
onUnmounted(() => clearInterval(intervalo))
```

60 segundos de intervalo, consulta liviana (mismo query que ya usa
`fetchMisTareasPendientes`, sin cambios en Supabase).

### Nuevo componente `app/components/shared/RecordatorioAlert.vue`

Alert individual, presentacional puro:

Props: `tarea: Tarea`.
Emits: `cerrar`, `click` (navega a la entidad, mismo patrón
`rutaEntidad` de `NotificationBell.vue`).

```html
<div class="border-l-4 rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 text-sm bg-[var(--color-warning-bg)] border-[var(--color-warning-text)] text-[var(--color-warning-text)]">
  <span class="text-base">⏰</span>
  <div class="flex-1 min-w-0 cursor-pointer" @click="$emit('click')">
    <p class="font-medium truncate">{{ tarea.titulo }}</p>
    <p class="text-xs opacity-80">Vence {{ formatearHora(tarea.fecha_vencimiento) }}</p>
  </div>
  <button class="opacity-60 hover:opacity-100" @click="$emit('cerrar')">✕</button>
</div>
```

`formatearHora`: muestra hora relativa simple ("en 12 min", "en 1
hora") — mismo espíritu que `formatearFecha` de `TareaList.vue` pero
enfocado en minutos/horas restantes ya que la ventana es de 30 min.

### Nuevo componente `app/components/shared/RecordatorioAlertContainer.vue`

Monta el estado global y apila los alerts, mismo patrón estructural
que `ToastContainer.vue`:

```html
<Teleport to="body">
  <div class="fixed top-20 right-4 z-50 space-y-2 w-80">
    <TransitionGroup name="toast">
      <SharedRecordatorioAlert
        v-for="t in tareasProximas"
        :key="t.id"
        :tarea="t"
        @cerrar="descartarTareaProxima(t.id)"
        @click="onClick(t)"
      />
    </TransitionGroup>
  </div>
</Teleport>
```

Posición `top-20 right-4` (debajo del topbar de 64px/`h-16`, mismo
lado que los toasts pero arriba, para no superponerse si coinciden
ambos). `onClick` resuelve la ruta igual que
`NotificationBell.vue::onClickNotificacion` (`rutaEntidad[tarea.
entidad_tipo]` + `/${tarea.entidad_id}`, sin ruta para `entidad_tipo
=== 'tarea'` — no aplica aquí porque las tareas ya vienen con
`entidad_tipo` de `lead|cliente|ticket`).

El `onMounted`/`setInterval`/`onUnmounted` del polling vive en este
contenedor.

### `app/layouts/default.vue`

Se agrega `<SharedRecordatorioAlertContainer />` junto a
`<SharedToastContainer />`, al final del template. Montado una sola
vez, visible en toda la app autenticada.

## Fuera de alcance

- No se toca el cron de Supabase ni la tabla `notificaciones` — ese
  sistema sigue manejando el aviso de tarea *ya vencida* vía campana;
  este alert cubre únicamente el tramo *antes* de vencer.
- No se toca `TareaList.vue` — sigue mostrando solo vencidas dentro
  del detalle, sin cambios.
- No se instala daisyUI.
- No se persiste el descarte entre recargas ni sesiones (decisión
  explícita: solo en memoria).
- Umbral de 30 min queda fijo en código (`UMBRAL_MINUTOS`), no
  configurable por el usuario.

## Testing (manual, sin suite automatizada)

1. Crear una tarea con `fecha_vencimiento` 15 minutos en el futuro:
   dentro del siguiente minuto (poll de 60s) aparece el alert en la
   esquina superior derecha, en cualquier página de la app.
2. Crear una tarea con vencimiento en 2 horas: no aparece alert.
3. Cerrar (✕) un alert: desaparece inmediatamente y no vuelve a
   aparecer aunque se navegue entre páginas, hasta recargar el
   navegador.
4. Recargar la página después de cerrar un alert cuya tarea sigue
   dentro de la ventana de 30 min: el alert vuelve a aparecer.
5. Click en el cuerpo del alert (no en ✕): navega al detalle de la
   entidad relacionada (lead/cliente/ticket).
6. Dos tareas próximas a la vez: se apilan verticalmente, cerrar una
   no afecta la otra.
7. Tarea que pasa de "próxima" a "vencida" mientras el alert está
   visible: en el siguiente poll (≤60s) el alert desaparece de esta
   lista (pasa a ser responsabilidad de la campana de notificaciones
   una vez que el cron horario la detecte).
