# Buscador de cliente en el formulario de Ticket

## Contexto

`app/components/tickets/TicketForm.vue` usa hoy un `<select>` con
**todos** los clientes cargados de una vez (`fetchClientes()` en
`onMounted`, sin límite) para elegir el cliente del ticket. Con ~1900
clientes en la base, es engorroso de usar (scroll largo, sin forma de
buscar por texto salvo el buscador nativo del navegador). Se pide
reemplazarlo por un buscador tipo autocompletar.

Este componente se usa en dos lugares:
- `app/pages/tickets/nuevo.vue` — creación. Si llega `?cliente_id=` en
  la URL (viene del detalle de un cliente, botón "+ ticket"), el campo
  queda fijo y deshabilitado (`clienteIdFijo`/`clienteNombreFijo`); ese
  caso no cambia.
- `app/pages/tickets/[id].vue` — edición. Se pasa
  `:model-value="ticket"` sin `clienteIdFijo`, así que hoy también
  muestra el `<select>` completo con el cliente actual ya seleccionado
  (porque venía en la lista cargada). El ticket (`useTickets.ts`) no
  trae el nombre del cliente, solo `cliente_id` — el `<select>` de hoy
  "resuelve" el nombre porque tiene la lista completa en memoria; el
  buscador nuevo no la tendrá, así que debe resolverlo por su cuenta.

Estado actual relevante:
- `app/composables/useClientes.ts`: expone `fetchClientes, getCliente,
  createCliente, updateCliente, deleteCliente, importClientes,
  subirImagenCliente`. No tiene una función de búsqueda acotada.
- `app/composables/useBusquedaGlobal.ts`: ya hace `ilike` sobre
  `razon_social, nombre_contacto, telefono, email, rut` con una función
  privada `escaparIlike()` (escapa `%`/`_`). Busca en paralelo sobre
  clientes/leads/tickets con límite de 5 por categoría — pensado para
  el buscador global (`GlobalSearch.vue`), no reutilizable tal cual acá
  (dispararía consultas innecesarias a leads/tickets y el límite es
  demasiado bajo para un picker dedicado a clientes).
- `app/components/shared/GlobalSearch.vue`: patrón de referencia para
  el autocompletar — input + dropdown de resultados, debounce de 300ms,
  mínimo 2 caracteres, cierre al hacer click afuera
  (`document.addEventListener('click', onClickFuera)` en
  `onMounted`/`onUnmounted`).

## Diseño

### `useClientes.ts` — nueva función `buscarClientes`

```ts
const buscarClientes = async (termino: string): Promise<Cliente[]> => {
  const q = termino.trim().replace(/[%_]/g, (m) => `\\${m}`)
  if (q.length < 2) return []

  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .or(`razon_social.ilike.%${q}%,nombre_contacto.ilike.%${q}%,rut.ilike.%${q}%`)
    .order('razon_social', { ascending: true })
    .limit(8)

  if (error) throw error
  return data as Cliente[]
}
```

Se agrega a la lista de retorno del composable. Es una consulta propia
y liviana (no reutiliza `useBusquedaGlobal`, ver Contexto) — el escape
de `%`/`_` se duplica acá como una línea inline en vez de extraer un
util compartido para una función de tres líneas.

Busca por razón social, RUT y nombre de contacto (no teléfono/email,
a diferencia del buscador global) — son los tres datos que un
vendedor típicamente tiene a mano para identificar un cliente al abrir
un ticket.

### Nuevo componente `app/components/clientes/ClienteBuscador.vue`

Combobox autocontenido: input de texto + dropdown de resultados, mismo
patrón técnico que `GlobalSearch.vue` (debounce 300ms, mínimo 2
caracteres, cierre al click afuera).

Props: `modelValue: string` (el `cliente_id` seleccionado, puede venir
vacío o con un id existente).
Emits: `update:modelValue`.

Comportamiento:
- Al montar: si `modelValue` no está vacío, llama `getCliente(id)` y
  precarga el input con `razon_social` — así el caso de edición de
  ticket muestra el cliente actual sin que `TicketForm.vue` tenga que
  pasarle el nombre aparte.
- Al escribir (≥2 caracteres, debounce 300ms): llama `buscarClientes`,
  muestra resultados en un dropdown (`razon_social` como texto
  principal, `rut` o `nombre_contacto` como texto secundario, mismo
  estilo visual que los resultados de clientes en `GlobalSearch.vue`).
- Al clickear un resultado: fija el input al `razon_social` elegido,
  emite `update:modelValue` con su `id`, cierra el dropdown.
- **Regla de integridad**: `update:modelValue` solo se emite al
  clickear un resultado. Si el usuario vuelve a escribir en el input
  después de haber seleccionado un cliente (cambia el texto sin
  clickear un nuevo resultado), se emite `update:modelValue` con
  `''` — evita que quede guardado un `cliente_id` que ya no coincide
  con lo que se ve en pantalla.
- Sin resultados / cargando / "escribe al menos 2 caracteres": mismos
  tres mensajes de estado que ya usa `GlobalSearch.vue`, adaptados a
  singular (un solo listado, no por categoría).

### `TicketForm.vue`

Donde hoy está:
```html
<select v-if="!clienteIdFijo" v-model="form.cliente_id" :class="inputClase">
  ...
</select>
```
pasa a:
```html
<ClientesClienteBuscador v-if="!clienteIdFijo" v-model="form.cliente_id" />
```

Se elimina el `fetchClientes()` de `onMounted` y el `ref<Cliente[]>([])`
de clientes — ya no hace falta cargar la lista completa. El caso
`clienteIdFijo` (input deshabilitado con el nombre fijo) no cambia.

## Fuera de alcance

- No se toca `tickets/nuevo.vue` ni `tickets/[id].vue` más allá de que
  siguen usando `TicketForm.vue` tal cual (el cambio vive adentro del
  componente).
- No se aplica este patrón a otros formularios con selects grandes de
  cliente (si los hay) — no se pidió, y no se detectó ningún otro caso
  igual de problemático en esta sesión (leads no seleccionan cliente
  desde `LeadForm.vue`).
- No se agrega paginación ni "cargar más" resultados en el dropdown —
  8 resultados alcanza para el caso de uso (afinar la búsqueda escribiendo
  más texto, no scrollear una lista larga).

## Testing (manual, sin suite automatizada)

1. `/tickets/nuevo` sin `?cliente_id=`: el campo cliente aparece vacío,
   escribir ≥2 caracteres de una razón social/RUT/contacto trae
   resultados, clickear uno lo fija y permite enviar el formulario.
2. `/tickets/nuevo?cliente_id=<id>` (desde el detalle de un cliente):
   sigue mostrando el input deshabilitado con el nombre fijo, sin
   buscador — comportamiento sin cambios.
3. Editar un ticket existente (`/tickets/[id]`): el campo cliente
   muestra precargada la razón social del cliente actual del ticket
   sin que el usuario tenga que buscar nada.
4. Desde la edición, buscar y elegir un cliente distinto, guardar: el
   ticket queda con el nuevo `cliente_id`.
5. Escribir en el input después de haber seleccionado un cliente, sin
   clickear ningún resultado nuevo, e intentar enviar: la validación
   de "Debes seleccionar un cliente" se dispara (el `cliente_id` se
   limpió).
6. Sin resultados para un término de búsqueda: mensaje "Sin resultados"
   visible, sin errores en consola.
