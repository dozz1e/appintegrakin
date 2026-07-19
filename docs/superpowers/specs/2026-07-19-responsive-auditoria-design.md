# Responsive /admin/auditoria — Design Spec

**Fecha:** 2026-07-19

## Contexto

Continuación de la fase 2 responsive (fase 1 shell y fase 3 Kanban ya
completas; fase 2 arrancó con `docs/superpowers/specs/2026-07-19-responsive-productos-listado-design.md`).
`/admin/auditoria` (`app/pages/admin/auditoria/index.vue`) no usa un
`<table>` como Productos — ya es una lista `<ul>`/`<li>` (patrón card), así
que no necesita el colapso tabla→card. El problema es otro: dos bloques
flex sin wrap que se aprietan o desbordan en pantalla angosta.

## Cambios

**1. Fila resumen** (`app/pages/admin/auditoria/index.vue:201`): el header
de cada `<li>` es `flex items-center justify-between` — badge+texto
descriptivo a la izquierda, hora a la derecha, sin `flex-wrap`. En mobile,
un texto largo (usuario + tabla + identificador) choca contra la hora.
Fix: `flex flex-wrap items-center justify-between gap-x-3 gap-y-1
sm:flex-nowrap` — la hora baja a su propia línea cuando no entra, sin
truncar ni perder información. Desde `sm:` se mantiene la línea única
actual (`sm:flex-nowrap`).

**2. Diff expandido** (`app/pages/admin/auditoria/index.vue:222-224`): cada
línea de diff es `flex items-center gap-2` con el label en `w-40
flex-shrink-0`, seguido de valor anterior → ícono flecha → valor nuevo,
todo en una fila. En mobile se aplasta. Fix: `flex flex-col sm:flex-row
sm:items-center gap-1 sm:gap-2` en el contenedor de cada línea, y el label
pasa de `w-40 flex-shrink-0` a `sm:w-40 sm:flex-shrink-0` (ancho completo
apilado en mobile, columna fija de nuevo desde `sm:`).

## Alcance

Un solo archivo, dos bloques de clases Tailwind. No toca `useAuditoria.ts`,
la fila de filtros (ya wrapea bien con `flex-wrap gap-2` existente) ni
`calcularDiff`.

## Testing

`npm run build` + verificación manual (usuario) en ventana angosta:
expandir un diff largo, confirmar que ninguna fila desborda el ancho de
pantalla ni corta contenido.
