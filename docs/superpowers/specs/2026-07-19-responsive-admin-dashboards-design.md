# Responsive /admin/dashboards — Design Spec

**Fecha:** 2026-07-19

## Contexto

Última página de fase 2 pendiente. `/admin/dashboards`
(`app/pages/admin/dashboards/index.vue:77-93`) tiene el mismo esqueleto
que `/admin/permisos` y `/capacitaciones`: `<li>` con `flex items-center
justify-between`, label (`w.label` + `w.descripcion` opcional) a la
izquierda y un botón toggle (Activo/Inactivo) a la derecha, sin wrap.
Confirmado en la base que hay combinaciones largas (ej. "Total tickets
(Servicio técnico)" + "Tickets activos + historial, servicio técnico") que
junto al botón no entran en una fila en mobile.

## Fix

Mismo patrón ya aplicado en `/admin/permisos` y `/capacitaciones`: `<li>`
pasa de `flex items-center justify-between text-sm border rounded px-3
py-2` a `flex flex-col sm:flex-row sm:items-center justify-between gap-2
text-sm border rounded px-3 py-2`. Acá solo hay un botón (no una fila de
3), así que no hace falta `flex-wrap` extra en el lado derecho.

## Alcance

Un solo archivo, un bloque de clases en el único `<li>` de la página.

## Testing

`npm run build` + verificación manual (usuario) en pantalla angosta: un
widget con descripción larga, confirmar que no desborda.
