# Calendario visual para agenda de capacitaciones

## Contexto

El módulo `/capacitaciones` (ver `2026-07-14-agenda-capacitaciones-design.md`)
se lanzó con vista de lista + filtro de fecha (desde/hasta), descartando
explícitamente un calendario visual "por costo de UI frente al beneficio
para el volumen de citas" (sección "Alternativas descartadas" de ese spec).

Se pide revertir esa decisión: agregar un calendario visual mensual junto
al listado existente. El listado (`citas_capacitacion`, tabla y composable
`useCitasCapacitacion`) no cambia — esto es una vista adicional sobre los
mismos datos, tal como el spec original anticipaba ("si en el futuro se
necesita, es una vista adicional sobre los mismos datos, no requiere
cambiar el modelo").

Decisiones tomadas durante el brainstorming:

- Layout de **dos columnas**: calendario a la izquierda (más ancho —
  "debe ser grande"), listado de citas a la derecha (el que ya existe,
  sin cambios de comportamiento propio).
- Calendario **mensual**, con navegación de mes (flechas) y de año
  (selector directo, no solo cruzando diciembre/enero).
- Cada día con citas muestra un **dot** (punto) simple — sin contador ni
  color por estado, solo indica presencia de al menos una cita ese día.
- Click en un día **filtra el listado** a las citas de ese día,
  reemplazando el filtro manual desde/hasta. Click de nuevo sobre el
  mismo día **deselecciona** (vuelve al listado sin filtro de día).
- Los atajos existentes "Hoy"/"Esta semana" y los inputs desde/hasta se
  mantienen tal como están; usarlos limpia la selección de día del
  calendario (se reemplazan mutuamente con la selección de día — nunca
  compiten dos filtros de fecha a la vez).
- En mobile/pantallas angostas las columnas se **apilan** (calendario
  arriba, listado abajo).
- Sin fetch nuevo: el calendario usa las mismas citas que ya carga
  `fetchCitas()` en `index.vue` (trae todas, sin límite de rango).

## Diseño

### Componente `CapacitacionesCalendarioMes.vue`

Nuevo componente presentacional en `app/components/capacitaciones/`,
mismo criterio que el resto de componentes `Capacitaciones*`/`Shared*`
del proyecto (sin dependencia externa — el proyecto no usa ninguna
librería de fechas ni de calendario hoy).

Props:
```ts
{
  citas: CitaCapacitacionConNombres[]   // mismo array que ya carga index.vue
  fechaSeleccionada: string | null      // YYYY-MM-DD, v-model
}
```

Emits: `update:fechaSeleccionada` (string | null).

Estado interno: `mesCursor` (mes/año que se está viendo — un `ref<Date>`
inicializado al mes actual). Navegar el calendario con las flechas o el
selector de año solo cambia `mesCursor`, nunca `fechaSeleccionada`.

Cálculo interno de citas por día (dentro del componente, a partir de la
prop `citas`):
```ts
const citasPorDia = computed(() => {
  const mapa = new Map<string, number>()
  for (const c of props.citas) {
    const key = c.fecha_hora.slice(0, 10) // YYYY-MM-DD, hora local
    mapa.set(key, (mapa.get(key) ?? 0) + 1)
  }
  return mapa
})
```
Solo se usa para decidir si pintar el dot (`mapa.has(key)`); no se
expone el conteo en la UI (se descartó la opción de contador).

### Grilla del mes

7 columnas (Dom a Sáb), semanas completas: incluye días del mes
anterior/siguiente en gris para rellenar la primera y última semana
(patrón estándar de calendario mensual). Celdas grandes — altura mínima
~90px en desktop, clickeables en toda su superficie (no solo el número),
para cumplir "calendario grande" pedido.

Cada celda: número de día, dot debajo si `citasPorDia.has(key)`. Un día
sin citas es igual de clickeable (filtra el listado a vacío — no se
bloquea, mantiene la interacción simple y predecible).

Día seleccionado: resaltado con el azul de marca (`#1075B5`), mismo
color ya usado en botones primarios del proyecto.

Header del calendario: flecha `‹` (mes anterior), nombre del mes,
selector `<select>` de año (rango año actual ± 5, suficiente para el
uso del negocio — sin selector de años lejanos), flecha `›` (mes
siguiente).

### Cambios en `index.vue`

Nuevo estado:
```ts
const fechaSeleccionada = ref<string | null>(null)
```

`citasFiltradas` cambia de fuente según haya día seleccionado:
```ts
const citasFiltradas = computed(() => {
  if (fechaSeleccionada.value) {
    return citas.value.filter(c => c.fecha_hora.slice(0, 10) === fechaSeleccionada.value)
  }
  // lógica actual desde/hasta, sin cambios
  return citas.value.filter((c) => { /* ... igual que hoy ... */ })
})
```

`filtrarHoy()` y `filtrarEstaSemana()`, y el watch/handler de los inputs
`filtroDesde`/`filtroHasta`, agregan `fechaSeleccionada.value = null` al
principio (limpian la selección de día del calendario).

El handler de `@update:fechaSeleccionada` del calendario limpia a su vez
`filtroDesde`/`filtroHasta` al setear una fecha:
```ts
function onDiaClick(fecha: string | null) {
  fechaSeleccionada.value = fecha
  if (fecha) {
    filtroDesde.value = ''
    filtroHasta.value = ''
  }
}
```

### Layout

Contenedor principal pasa de una columna a grilla dos columnas:
```html
<div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
  <CapacitacionesCalendarioMes :citas="citas" v-model:fecha-seleccionada="fechaSeleccionada" />
  <div><!-- filtros + listado existentes, sin cambios de estructura --></div>
</div>
```
Bajo `lg` (pantallas angostas) se apilan en una columna: calendario
arriba, listado abajo.

## Decisión revertida

Este spec revierte la decisión "sin calendario visual" tomada en
`2026-07-14-agenda-capacitaciones-design.md` (sección "Alternativas
descartadas" y "Fuera de alcance", punto 28 del Roadmap). El modelo de
datos (`citas_capacitacion`) no cambia — como anticipaba ese spec, el
calendario es una vista adicional sobre los mismos datos.

## Fuera de alcance

- Sin drag & drop de citas sobre el calendario.
- Sin vista semana/día dentro del calendario (solo mes).
- Sin crear cita haciendo click en un día vacío — se sigue usando el
  botón "+ Nueva capacitación" existente.
- Sin contador de citas por día ni color por estado en el dot — solo
  presencia/ausencia.
- Sin fetch acotado por mes visible — se sigue trayendo todo el listado
  de una vez (`fetchCitas()` sin cambios; volumen esperado no lo
  justifica, mismo criterio que el resto del módulo).

## Testing (manual, sin suite automatizada)

Se agrega a los 10 casos ya cubiertos en el spec original:

11. Click en un día con citas → el listado de la derecha muestra solo
    las citas de ese día; los inputs desde/hasta quedan vacíos.
12. Click de nuevo sobre el mismo día ya seleccionado → deselecciona,
    el listado vuelve a mostrarse sin filtro de día (respeta desde/hasta
    si tenían algo cargado antes, o completo si no).
13. Con un día seleccionado, usar "Hoy", "Esta semana", o escribir en
    los inputs desde/hasta manualmente → limpia la selección de día del
    calendario, el filtro manual toma el control.
14. Navegar de mes con las flechas, o cambiar de año con el selector →
    no altera `fechaSeleccionada` ni el listado (son independientes).
15. Día con múltiples citas de distintos clientes → el dot aparece una
    sola vez (no un dot por cita); el listado filtrado muestra todas.
16. Pantalla angosta (mobile) → las columnas se apilan, calendario
    arriba y listado abajo, sin scroll horizontal.
17. Día del mes anterior/siguiente mostrado en gris para completar la
    grilla → sigue siendo clickeable y filtra correctamente (no es solo
    decorativo).
