# Responsive /capacitaciones — Design Spec

**Fecha:** 2026-07-19

## Contexto

Continuación de la fase 2 responsive. `/capacitaciones`
(`app/pages/capacitaciones/index.vue`) ya colapsa bien a 1 columna en
mobile (`grid grid-cols-1 lg:grid-cols-[1.3fr_1fr]`) y el calendario
(`CalendarioMes.vue`) usa `grid-cols-7` fluido, sin overflow. El problema
real es la fila de cada cita (`app/pages/capacitaciones/index.vue:187-221`):
`flex items-center justify-between gap-3` con un bloque de texto
(`min-w-0`) a la izquierda y, a la derecha, badge + hasta 4 botones
(Editar/Completar/Cancelar/Eliminar) todos `shrink-0` sin wrap — en mobile
esa fila de acciones desborda el ancho de la card.

## Fix

`<li>` pasa de `flex items-center justify-between gap-3` a `flex flex-col
sm:flex-row sm:items-center justify-between gap-3` — el bloque de texto
queda arriba y las acciones abajo en su propia línea en mobile, vuelven a
compartir fila desde `sm:`. El contenedor de acciones
(`flex items-center gap-2 shrink-0`) suma `flex-wrap` como resguardo si
tampoco entran los 5 elementos en una sola línea en una pantalla muy
angosta, y pierde el `shrink-0` (ya no aplica al estar en su propia fila).

## Alcance

Un solo archivo, un bloque de clases. No toca `CalendarioMes.vue`
(sin problema) ni la lógica de filtros/estado.

## Testing

`npm run build` + verificación manual (usuario) en pantalla angosta: una
cita con los 4 botones de acción visibles, confirmar que no desborda.
