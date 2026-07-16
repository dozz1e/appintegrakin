# Múltiples umbrales configurables para RecordatorioAlert

## Contexto

Hoy `RecordatorioAlert`/`RecordatorioAlertContainer` avisa tareas y citas
de capacitación próximas a vencer con un solo umbral configurable por
usuario (`profiles.settings.umbral_alertas_minutos`, número de minutos,
default 30 si no está seteado — ver
`docs/superpowers/specs/2026-07-13-recordatorio-alert-design.md`, que
documenta el umbral como fijo en código; quedó desactualizado cuando se
hizo configurable, sin un spec propio para ese cambio). Se pide poder
configurar **varios** umbrales a la vez (ej. avisar 1 día antes, 1 hora
antes y 15 minutos antes), en unidades de **días, horas o minutos**.

Decisión de producto (validada con el usuario):
- Descarte (botón ✕) es **independiente por umbral**: cerrar el aviso de
  "1 hora antes" no apaga el de "15 min antes" — cada umbral cruzado que
  el usuario no descartó específicamente vuelve a mostrarse.
- Default para quien nunca configuró nada: se mantiene el comportamiento
  actual, un solo umbral de 30 minutos (no se agregan umbrales nuevos de
  regalo).
- Aplica igual a tareas y a citas de capacitación (mismo criterio que
  hoy — un único set de umbrales por usuario, no separado por tipo).

Estado actual relevante (código real, revisado):
- `app/composables/useTareas.ts:14,103-114`: `UMBRAL_MINUTOS_DEFAULT = 30`,
  `refrescarTareasProximas` lee `perfil.value?.settings?.umbral_alertas_minutos`
  (número simple), filtra `msRestante <= umbralMinutos * 60_000` (sin piso,
  así que ya vencidas también entran).
- `app/composables/useCitasCapacitacion.ts:22,114-125`: mismo patrón
  exacto, duplicado.
- `app/composables/useTareas.ts:135-148` (`descartarTareaProxima`) /
  `useCitasCapacitacion.ts:140-155` (`descartarCitaProxima`): descarte
  hoy es por `(user_id, tarea_id)` — global para toda la tarea, sin
  noción de umbral.
- `supabase/migrations/20260714010000_tareas_descartadas.sql` /
  `20260714060000_citas_descartadas.sql`: PK compuesta
  `(user_id, tarea_id)` / `(user_id, cita_id)`, sin columna de umbral.
- `app/components/shared/ConfiguracionModal.vue:9,21-22,39,60-69`: un
  solo `<input type="number">` ligado a `umbralMinutos`, guardado vía
  `actualizarConfiguracion({ umbral_alertas_minutos: umbralMinutos.value })`.
- `app/composables/useMiPerfil.ts:76-88`: `actualizarConfiguracion(patch)`
  mergea `patch` dentro de `profiles.settings` (jsonb libre, sin
  migración por campo nuevo — ver
  `docs/superpowers/specs/2026-07-13-user-menu-profile-config-design.md`).
- Ningún otro archivo consume `tareasProximas`/`citasProximas`/
  `descartarTareaProxima`/`descartarCitaProxima` fuera de
  `useTareas.ts`, `useCitasCapacitacion.ts` y
  `RecordatorioAlertContainer.vue` (confirmado por grep) — se puede
  cambiar la forma interna de descarte sin romper otros consumidores.

## Diseño

### Nuevo composable compartido `app/composables/useUmbralesAlertas.ts`

Evita duplicar la conversión de unidades y el cálculo de "umbral actual"
entre `useTareas.ts` y `useCitasCapacitacion.ts`:

```ts
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

Por qué este modelo resuelve "descarte independiente por umbral": el
tier no es un umbral fijo, es "el umbral más específico ya cruzado en
este instante". Si el usuario descarta el aviso cuando el tier vigente
es 60 (min), se guarda el descarte para `(tarea_id, 60)`. Cuando pasa el
tiempo y el tier vigente pasa a ser 15 (un umbral más chico, cruzado
recién), es una clave distinta — no está descartada, así que reaparece.
Si nunca se cruza un umbral más chico y la tarea vence, el tier pasa a
`0` (vencida), también una clave distinta.

### Migración `supabase/migrations/20260716030000_umbral_tier_dismiss.sql`

```sql
alter table tareas_descartadas add column umbral_minutos integer not null default 0;
alter table tareas_descartadas drop constraint tareas_descartadas_pkey;
alter table tareas_descartadas add primary key (user_id, tarea_id, umbral_minutos);

alter table citas_descartadas add column umbral_minutos integer not null default 0;
alter table citas_descartadas drop constraint citas_descartadas_pkey;
alter table citas_descartadas add primary key (user_id, cita_id, umbral_minutos);
```

Filas viejas (pocas, feature de días) quedan con `umbral_minutos = 0`
("vencida") — aceptable, en el peor caso alguien ve reaparecer un aviso
ya descartado una vez, no rompe nada.

### `app/composables/useTareas.ts`

- Nuevo estado: `tierActualTareas = useState<Map<string, number>>('tareas-proximas-tier', () => new Map())`
  — guarda, por `tarea_id`, el tier vigente calculado en el último
  refresh (necesario para que `descartarTareaProxima` sepa qué tier
  descartar).
- `idsTareasDescartadas` pasa a guardar claves compuestas
  `` `${tarea_id}:${tier}` `` en vez de solo `tarea_id`.
- `refrescarTareasProximas`:

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

- `descartarTareaProxima`:

```ts
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

- `cargarDescartadasGuardadas`:

```ts
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

`UMBRAL_MINUTOS_DEFAULT` se elimina de este archivo (se reemplaza por
`UMBRAL_ALERTA_DEFAULT` del composable compartido).

### `app/composables/useCitasCapacitacion.ts`

Mismos cinco cambios, en espejo (`tierActualCitas`, claves
`` `${cita_id}:${tier}` ``, `cita_id`/`umbral_minutos` en vez de
`tarea_id`/`umbral_minutos`, `citas_descartadas` en vez de
`tareas_descartadas`).

### `app/components/shared/ConfiguracionModal.vue`

Reemplazar el único `<input>` de `umbralMinutos` por una lista editable
de `UmbralAlerta[]`:

```ts
const umbrales = ref<UmbralAlerta[]>([{ ...UMBRAL_ALERTA_DEFAULT }])

// dentro del watch de props.open, reemplaza la carga de umbralMinutos:
const config = perfil.value?.settings?.umbrales_alertas
umbrales.value = Array.isArray(config) && config.length > 0
  ? structuredClone(config as UmbralAlerta[])
  : [{ ...UMBRAL_ALERTA_DEFAULT }]

function agregarUmbral() {
  umbrales.value.push({ valor: 15, unidad: 'minutos' })
}
function quitarUmbral(i: number) {
  if (umbrales.value.length > 1) umbrales.value.splice(i, 1)
}
```

Validación en `onGuardar`: cada `umbral.valor >= 1` (mismo criterio que
el input actual `min="1"`), al menos un umbral en la lista (no se puede
vaciar del todo — si se quiere "no avisar nunca" es una feature aparte,
fuera de alcance). Guardar con
`actualizarConfiguracion({ umbrales_alertas: umbrales.value })` (el
campo viejo `umbral_alertas_minutos` se deja de escribir, no se borra).

Template: por cada fila, un `<input type="number" v-model.number="u.valor">`
+ `<select v-model="u.unidad">` (opciones minutos/horas/días) + botón
quitar (✕, deshabilitado si `umbrales.value.length === 1`), y debajo un
botón "+ Agregar umbral", mismo estilo Tailwind que el resto del modal
(`border-border`, `focus:ring-primary-ring`).

## Fuera de alcance

- No se toca `RecordatorioAlert.vue` ni `RecordatorioAlertContainer.vue`
  — siguen mostrando una sola tarjeta por tarea/cita (la que está en
  `tareasProximas`/`citasProximas`), sin indicar visualmente a qué
  umbral corresponde el aviso actual.
- No se permite "sin umbrales" (desactivar avisos por completo) — se
  fuerza al menos uno en la lista.
- No se separan umbrales distintos para tareas vs. citas — un solo set
  compartido, igual que hoy.
- El campo viejo `settings.umbral_alertas_minutos` no se migra ni se
  borra, solo se deja de leer/escribir.

## Testing (manual, sin suite automatizada)

1. Configurar dos umbrales (1 hora y 15 min) en `/` → menú de usuario →
   Configuración.
2. Crear una tarea que vence en 45 min: aparece el aviso (ya cruzó el
   umbral de 1 hora).
3. Descartar ese aviso (✕): desaparece. Esperar (o simular) a que falten
   10 min: reaparece (cruzó el umbral de 15 min, tier distinto, no
   estaba descartado).
4. Descartar de nuevo, dejar que la tarea venza: reaparece en rojo
   ("venció hace..."), tier `0`, distinto de los anteriores.
5. Descartar la vencida: no vuelve a aparecer (no hay tier más chico que
   0).
6. Repetir 2-5 con una cita de capacitación.
7. Quitar todos los umbrales menos uno en Configuración, guardar,
   confirmar que ya no se puede borrar el último.
8. Usuario que nunca abrió Configuración: sigue viendo el comportamiento
   de hoy (aviso a 30 min, sin cambios).
