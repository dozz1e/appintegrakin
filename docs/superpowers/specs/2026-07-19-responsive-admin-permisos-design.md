# Responsive /admin/permisos — Design Spec

**Fecha:** 2026-07-19

## Contexto

Continuación de la fase 2 responsive. `/admin/permisos`
(`app/pages/admin/permisos/index.vue:101-133`) ya está en un contenedor
`max-w-3xl mx-auto` y el select de usuario es `w-full` — sin problema. El
gap está en cada `<li>` de permiso: `flex items-center justify-between`
con el label (`p.action` + "(rol: sí/no)") a la izquierda y 3 botones
(Heredado/Otorgar/Revocar) a la derecha, sin wrap. En mobile (~327px útiles
dentro del padding) label + 3 botones no entran en una fila y desbordan —
mismo patrón que se resolvió recién en `/capacitaciones` (spec
`2026-07-19-responsive-capacitaciones-design.md`) y `/admin/auditoria`.

## Fix

`<li>` pasa de `flex items-center justify-between text-sm border rounded
px-3 py-2` a `flex flex-col sm:flex-row sm:items-center justify-between
gap-2 text-sm border rounded px-3 py-2` — label arriba, fila de 3 botones
abajo en mobile, vuelven a compartir línea desde `sm:`.

## Alcance

Un solo archivo, un bloque de clases en el `<li>` de la sección
"Permisos por usuario". No toca `admin/usuarios/index.vue` (ya revisado,
sin problema — solo label + un checkbox, no desborda) ni la lógica de
`usePermisosOverrides.ts`.

## Testing

`npm run build` + verificación manual (usuario) en pantalla angosta: un
usuario con varios permisos visibles, confirmar que ninguna fila desborda.
