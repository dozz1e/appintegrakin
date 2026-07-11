# Vista de detalle (split view) para Clientes

## Contexto

Pedido del usuario: agregar una segunda vista a `/clientes`, inspirada en
un mockup de un CRM inmobiliario (`contactos.jpg`, adjuntado por el
usuario) — un layout de 3 columnas (lista de contactos | detalle del
contacto seleccionado con métricas y tabs | notas). La vista actual
(`ClientesClienteTable`, una tabla simple) se mantiene sin cambios; se
agrega un ícono en el header de la página para alternar entre las dos.

El mockup es de un CRM de bienes raíces (deals, propiedades, specialty
"Realtor") — varios de sus elementos no tienen equivalente en este CRM
(que administra clientes B2B de medicina estética: `razon_social`, RUT,
tickets de soporte). El diseño abajo adapta el layout a los datos reales
del proyecto en vez de imitar literalmente el contenido del mockup.

Estado actual relevante:
- `app/pages/clientes/index.vue`: carga `clientes` con `fetchClientes()`,
  renderiza `<ClientesClienteTable :clientes="clientes" @eliminar="..." />`.
- `app/pages/clientes/[id].vue`: página de detalle/edición existente (ruta
  independiente, **no se toca** en este cambio) — usa `ClienteForm`,
  gestiona `updateCliente` con optimistic locking (`version`), y lista los
  tickets del cliente vía `fetchTicketsPorCliente`.
- `app/components/clientes/ClienteForm.vue`: formulario controlado,
  `defineProps<{ modelValue?: Partial<Cliente>; cargando?: boolean }>()`,
  `defineEmits<{ submit: [payload: Partial<Cliente>] }>()` — ya reutilizable
  tal cual.
- `app/components/shared/Avatar.vue`: `<SharedAvatar :nombre="..." size="sm"|"md" />`,
  iniciales + color determinístico por hash del nombre.
- `app/components/shared/TareaList.vue` (`SharedTareaList`): ya soporta
  `entidad-tipo="cliente"` (el tipo `Tarea['entidad_tipo']` es
  `'lead' | 'cliente' | 'ticket'`) — hoy solo se usa en
  `app/pages/leads/[id].vue`, nunca en clientes. Se reutiliza tal cual, sin
  tocar `useTareas.ts`.
- `useTickets().fetchTicketsPorCliente(clienteId)` y `EstadoTicket = 'abierto' |
  'en_proceso' | 'esperando_cliente' | 'resuelto' | 'cerrado'` ya existen.
  La convención de "abierto" para KPIs ya establecida en
  `KpiTicketsAbiertos.vue` es `estado !== 'cerrado'` — se reutiliza la misma
  definición acá para consistencia.
- `<Icon name="mdi:...">` (`@nuxt/icon`) ya se usa en el proyecto
  (`LeadTimeline.vue:88`) — se reutiliza el mismo patrón para el ícono de
  toggle.

## Decisiones de producto (validadas con el usuario)

1. **La tabla actual no cambia.** `ClientesClienteTable` sigue siendo la
   vista por defecto; la vista nueva es una alternativa, no un reemplazo.
2. **Un solo ícono de toggle** en el `#accion` del `SharedPageHeader` de
   `/clientes`, junto a los botones existentes (Exportar/Importar/Nuevo
   cliente). Alterna entre `vista: 'lista' | 'detalle'`, sin persistir la
   preferencia (siempre arranca en `'lista'`).
3. **Métricas del panel central: basadas en tickets**, no en "deals"
   (que no existen en este dominio) — Total tickets, Abiertos, Resueltos,
   calculados de los tickets del cliente seleccionado.
4. **Panel derecho: `SharedTareaList` con `entidad-tipo="cliente"`**, en vez
   del "Noted + Chat" del mockup (no hay sistema de chat en este CRM).
5. **El panel central es editable ahí mismo** — incluye `ClienteForm`
   dentro de un tab "Información", con el mismo flujo de guardado
   (optimistic locking, manejo de `CONFLICTO_VERSION`) que ya usa
   `clientes/[id].vue`.
6. **Fuera de alcance:** eliminar cliente (sigue solo en `/clientes/[id]`),
   la tarjeta de "propiedad" del mockup (sin dato equivalente), la barra de
   íconos y el header del mockup (el layout ya existente en
   `app/layouts/default.vue` cubre navegación/búsqueda/avatar de usuario —
   replicarlos sería duplicado).

## Diseño

### Toggle de vista (`app/pages/clientes/index.vue`)

Un `ref<'lista' | 'detalle'>('lista')`. Un botón (no dos) en el `#accion`
del `SharedPageHeader`, que muestra el ícono/título de la vista *a la que
se cambiaría* (mismo patrón que tenía el botón de tema oscuro ya
removido: título y contenido dependen del estado actual):

- En `'lista'`: ícono `mdi:card-account-details-outline`, título "Ver
  detalle".
- En `'detalle'`: ícono `mdi:view-list`, título "Ver como lista".

El template pasa de renderizar `<ClientesClienteTable>` a renderizar
`<ClientesClienteSplitView :clientes="clientes" @actualizado="..." />`
según `vista`. `@actualizado` es el mismo patrón que ya usa
`onConfirmarEliminar` en este archivo (mutar el array `clientes.value` en
el sitio, sin refetch): al guardar una edición dentro del split view, se
reemplaza el cliente correspondiente en el array local para que la tabla
muestre los datos frescos si el usuario vuelve a esa vista.

### `ClienteSplitView.vue` (nuevo, `app/components/clientes/`)

**Props:** `{ clientes: Cliente[] }`. **Emits:** `{ actualizado: [cliente: Cliente] }`.

**Layout:** 3 columnas con `flex` (no grid, porque los anchos son fijos en
los extremos y fluidos en el centro): `w-72 shrink-0` (izquierda), `flex-1
min-w-0` (centro), `w-80 shrink-0` (derecha). Alto total con scroll interno
en la columna izquierda (`overflow-y-auto`) para que la lista larga no
empuje el layout.

**Columna izquierda — lista:**
- Input de búsqueda (`ref<string>('')`), filtra client-side por
  `razon_social` o `nombre_contacto` (`includes`, case-insensitive) sobre
  la prop `clientes` — sin llamada nueva a Supabase.
- Lista de resultados: `<SharedAvatar :nombre="c.razon_social" size="sm" />`
  + `razon_social` + `nombre_contacto` (secundario, gris). Fila resaltada
  si `c.id === seleccionadoId`. Clic setea `seleccionadoId.value = c.id`
  — sin navegación, todo es estado local del componente.

**Estado de selección:**
- `seleccionadoId = ref<string | null>(null)` — arranca sin selección.
- `seleccionado = computed(() => clientes.find(c => c.id === seleccionadoId.value) ?? null)`.
- `watch(seleccionadoId, ...)`: si hay permiso de tickets
  (`can('tickets','view') || can('tickets','view_all')`) y hay selección,
  llama `fetchTicketsPorCliente(seleccionadoId.value)` y guarda el
  resultado en `ticketsSeleccionado = ref<Ticket[]>([])`. Si no hay
  selección, limpia el array.

**Columna centro — sin selección:** mensaje simple ("Selecciona un
cliente de la lista para ver su detalle.") en vez de las 3 subcolumnas.

**Columna centro — con selección:**
- Header: `<SharedAvatar size="md">` + `razon_social` como título +
  fila con RUT / `nombre_contacto` / teléfono / email (mismos campos que
  ya muestra `ClienteForm`, acá solo de lectura arriba, a modo de resumen
  rápido).
- Fila de 3 tarjetas (solo si hay permiso de tickets — si no, se omite
  toda la fila): Total tickets (`ticketsSeleccionado.length`), Abiertos
  (`estado !== 'cerrado'`), Resueltos (`estado === 'resuelto'`). Reutiliza
  visualmente el mismo estilo compacto que ya tiene `WidgetsKpiCard`
  (ícono redondo + label + valor), pero sin fetch propio — recibe los
  números ya calculados vía props, porque acá los datos vienen del
  `ticketsSeleccionado` del split view, no de un fetch independiente por
  tarjeta como hacen los widgets del dashboard.
- Tabs (`tabActiva = ref<'info' | 'tickets'>('info')`, solo se muestra el
  tab "Tickets" si hay permiso):
  - **Información:** `<ClientesClienteForm :model-value="seleccionado"
    :cargando="guardando" @submit="onSubmit" />` — `onSubmit` es
    exactamente la misma lógica que hoy tiene `clientes/[id].vue`
    (`updateCliente` con `seleccionado.version`, catch de
    `CONFLICTO_VERSION` con mensaje de error y recarga), salvo que al
    terminar con éxito además hace `emit('actualizado', clienteActualizado)`
    para que el padre sincronice su array.
  - **Tickets:** la misma lista que hoy tiene `clientes/[id].vue` (item con
    `NuxtLink` a `/tickets/[id]`, badge de estado vía `colorTicket`, link
    "+ Nuevo ticket" a `/tickets/nuevo?cliente_id=...` si
    `can('tickets','create')`), usando `ticketsSeleccionado` en vez de un
    `tickets` propio de la página.

**Columna derecha:** `<SharedTareaList entidad-tipo="cliente"
:entidad-id="seleccionado.id" />` si hay selección; si no, se omite (no
tiene sentido mostrar un formulario de tareas sin entidad a la cual
atarlas).

## Fuera de alcance

- No se toca `app/pages/clientes/[id].vue` — sigue siendo la ruta directa
  de detalle/edición, funciona igual que hoy para cualquier link externo
  que apunte ahí (ej. desde tickets).
- No se agrega eliminar cliente en la vista nueva.
- No se persiste la preferencia de vista (`localStorage` u otro) — decisión
  explícita, YAGNI para esta primera versión.
- No se agrega chat ni ningún dato de "deals"/propiedades — no existen en
  este dominio.
- No se cambia `useClientes.ts`, `useTareas.ts`, `useTickets.ts`,
  `ClienteForm.vue`, `ClienteTable.vue`, `Avatar.vue` ni `TareaList.vue` —
  todo se reutiliza tal cual.
- No se agrega paginación ni virtualización a la lista izquierda — mismo
  supuesto de volumen que ya asume `ClienteTable.vue` hoy (carga completa
  vía `fetchClientes()`, sin paginar).

## Testing (manual, sin suite automatizada aún)

1. En `/clientes`, confirmar que el botón de toggle cambia entre la tabla
   actual (sin cambios visuales) y la vista nueva de 3 columnas.
2. En la vista nueva, sin seleccionar nada: confirmar el mensaje de
   placeholder en el centro y que no aparece el panel de tareas a la
   derecha.
3. Buscar un cliente por nombre en el buscador izquierdo y confirmar que
   filtra correctamente (razón social y nombre de contacto).
4. Seleccionar un cliente y confirmar: aparecen sus datos en el header del
   panel central, las 3 tarjetas muestran números coherentes con sus
   tickets reales (comparar contra `/clientes/[id]` del mismo cliente), y
   el tab "Información" muestra el formulario con sus datos actuales.
5. Editar un campo en el tab "Información" y guardar — confirmar que se
   guarda correctamente (mismo comportamiento que `/clientes/[id]`, incluido
   el caso de conflicto de versión si se simula edición concurrente), y
   que al volver a la vista de tabla el dato editado aparece actualizado
   sin recargar la página.
6. Cambiar al tab "Tickets" y confirmar que lista los tickets del cliente
   seleccionado, con el link "+ Nuevo ticket" si corresponde por permiso.
7. Confirmar que el panel de tareas a la derecha permite crear una tarea
   para el cliente seleccionado, y que cambiar de cliente seleccionado
   actualiza la lista de tareas mostrada (las de la nueva selección, no
   las de la anterior).
8. Repetir los pasos con un usuario que NO tenga permiso `tickets.view`/
   `view_all`: confirmar que no aparecen ni la fila de tarjetas ni el tab
   "Tickets", sin errores en consola.
