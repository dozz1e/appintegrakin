# Vista de detalle de Lead en columnas

## Contexto

Pedido del usuario: reordenar la vista de detalle de un lead individual
(`app/pages/leads/[id].vue`) en varias columnas, dejando una columna
dedicada solo al historial de interacciones y otra columna dedicada solo
a tareas y recordatorios.

Alcance: únicamente `app/pages/leads/[id].vue`. No se toca
`leads/index.vue`, `LeadKanban.vue`, ni la vista de clientes
(`clientes/[id].vue`, que hoy tiene la misma estructura de una sola
columna pero queda fuera de este cambio).

Estado actual (`app/pages/leads/[id].vue`):
- Contenedor `<div class="p-6 max-w-lg">` — una sola columna angosta.
- Todo apilado verticalmente en este orden: `SharedPageHeader` →
  `LeadsLeadForm` (dentro de `SharedCard`) → tarjeta "Convertir a
  cliente" (o aviso "ya convertido") → `SharedTareaList
  entidad-tipo="lead"` → `LeadsLeadTimeline` (historial) → tarjeta
  "Eliminar lead" (solo si `can('leads','delete')`).
- `LeadsLeadTimeline.vue`: ya es un componente autocontenido
  (`SharedCard titulo="Historial de interacciones"`), recibe solo
  `lead-id`, hace su propio fetch/estado — se reutiliza tal cual.
- `SharedTareaList` (`app/components/shared/TareaList.vue`): ya
  autocontenido, recibe `entidad-tipo` y `entidad-id` — se reutiliza tal
  cual.
- `LeadsLeadForm.vue`: formulario controlado, sin cambios.
- No hay cambios de datos, permisos ni composables — es puramente un
  reordenamiento de markup/CSS en una sola página.

## Decisiones de producto (validadas con el usuario)

1. **3 columnas en pantallas grandes**, con la columna de información del
   lead más ancha que las otras dos (proporción aprox. `1.3fr / 1fr /
   1fr`):
   - **Columna 1 (info):** header, `LeadForm`, tarjeta "Convertir a
     cliente" (o aviso de convertido), tarjeta "Eliminar lead" — mismo
     orden que existe hoy, ahora agrupado en su propia columna.
   - **Columna 2:** solo `LeadsLeadTimeline` (historial de interacciones).
   - **Columna 3:** solo `SharedTareaList` (tareas y recordatorios).
2. **Responsivo:** por debajo del breakpoint `lg` (1024px), las columnas
   se apilan en una sola columna, en el orden Info → Historial → Tareas
   (mismo orden que la columna 1/2/3 de izquierda a derecha, para no
   introducir un reordenamiento adicional entre vista ancha y angosta).
3. **El contenedor de la página deja de ser `max-w-lg`** (muy angosto
   para 3 columnas) y pasa a un ancho mayor (ej. `max-w-6xl`) para dar
   espacio a las 3 columnas en pantallas grandes.
4. **Sin cambios funcionales**: ningún composable, permiso, validación ni
   lógica de negocio cambia. `LeadsLeadTimeline` y `SharedTareaList` se
   usan exactamente igual que hoy (mismas props), solo cambia dónde
   quedan ubicados en el layout.

## Diseño

### `app/pages/leads/[id].vue`

Cambiar el contenedor raíz de `<div class="p-6 max-w-lg">` a
`<div class="p-6 max-w-6xl">`.

Envolver el contenido (una vez cargado el lead) en un grid:

```html
<div class="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr] gap-6 items-start">
  <!-- columna 1: info -->
  <div class="space-y-6">
    <SharedCard><LeadsLeadForm ... /></SharedCard>
    <!-- convertir a cliente / ya convertido -->
    <!-- eliminar lead (si can delete) -->
  </div>

  <!-- columna 2: historial -->
  <LeadsLeadTimeline :lead-id="lead.id" />

  <!-- columna 3: tareas -->
  <SharedTareaList entidad-tipo="lead" :entidad-id="lead.id" />
</div>
```

`SharedPageHeader` queda fuera del grid, arriba de todo (como hoy), ya
que es el título de la página completa, no de la columna de info.

`items-start` en el grid evita que una columna más alta (ej. el
historial con muchas interacciones) estire las tarjetas de las otras
columnas.

El diálogo `SharedConfirmDialog` de eliminar queda fuera del grid, al
final del template (como hoy — es un modal, no ocupa layout).

## Fuera de alcance

- No se toca `leads/index.vue`, `LeadKanban.vue`, ni ninguna vista de
  clientes o tickets.
- No se agregan tabs, buscador, ni ningún elemento nuevo — es
  estrictamente reubicar los bloques existentes en un grid de 3 columnas.
- No se cambian `LeadsLeadTimeline.vue`, `SharedTareaList.vue`,
  `LeadsLeadForm.vue` ni ningún composable (`useLeads`,
  `useLeadInteracciones`, `useTareas`).
- No se persiste ninguna preferencia de layout — es un único layout fijo
  (con su versión responsiva apilada), no hay toggle entre vistas.

## Testing (manual, sin suite automatizada aún)

1. Abrir el detalle de un lead en una pantalla ancha (≥1024px):
   confirmar 3 columnas visibles simultáneamente — info a la izquierda
   (más ancha), historial al centro, tareas a la derecha.
2. Confirmar que la columna de historial muestra únicamente
   `LeadsLeadTimeline` (sin la tarjeta de tareas ni la de info mezcladas
   ahí).
3. Confirmar que la columna de tareas muestra únicamente
   `SharedTareaList` con sus tareas/recordatorios del lead.
4. Reducir el ancho de la ventana por debajo de 1024px: confirmar que las
   3 columnas se apilan verticalmente en el orden Info → Historial →
   Tareas, sin overflow horizontal ni elementos cortados.
5. Con un lead sin `cliente_id` y usuario con permiso de convertir:
   confirmar que la tarjeta "Convertir a cliente" sigue apareciendo en la
   columna de info, y que convertir sigue redirigiendo a
   `/clientes/[id]` como hoy.
6. Con un usuario con permiso `leads.delete`: confirmar que la tarjeta
   "Eliminar lead" aparece al final de la columna de info y que el flujo
   de confirmación/eliminación sigue funcionando igual que hoy.
7. Agregar una interacción nueva en el historial (columna 2) y confirmar
   que aparece sin afectar el estado de las otras columnas.
8. Crear una tarea nueva en la columna de tareas y confirmar que aparece
   sin afectar el estado de las otras columnas.
