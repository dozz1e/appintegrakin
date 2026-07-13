# Filtro por vendedor en la vista de Clientes

## Contexto

Segunda vez que se piden filtros en una vista de listado esta sesión (la
primera fue el catálogo de productos, ver
`docs/superpowers/specs/2026-07-12-productos-catalogo-design.md`). La
vista de clientes (`app/pages/clientes/index.vue` +
`app/components/clientes/ClienteSplitView.vue`) ya tiene un buscador de
texto libre (razón social / nombre de contacto) client-side, pero
ningún filtro estructurado. Se pide agregar un filtro por vendedor
asignado (`owner_id`).

Decisión de producto (validada con el usuario): el único filtro
adicional pedido es **vendedor asignado**. No se agregan otros filtros
(RUT, fecha de creación, etc.) en este pedido.

Estado actual relevante:
- `app/pages/clientes/index.vue`: `onMounted` llama
  `fetchClientes()` una vez, guarda todo en `clientes = ref<Cliente[]>([])`,
  pasa la lista completa a `ClienteSplitView` como prop.
- `app/components/clientes/ClienteSplitView.vue`: mantiene su propio
  `busqueda = ref('')` y filtra client-side vía el computed
  `clientesFiltrados` sobre `props.clientes` (razón social / nombre de
  contacto, `includes` case-insensitive).
- `app/composables/useUsuarios.ts`: `fetchUsuarios(): Promise<Usuario[]>`
  trae todos los usuarios activos — ya se reutiliza tal cual en
  `admin/auditoria/index.vue` para el mismo propósito (poblar un
  selector de usuario). Se reutiliza acá sin cambios.
- `Cliente.owner_id: string | null` (`useClientes.ts`) — puede ser
  `null` (cliente sin vendedor asignado).

## Diseño

**Filtrado 100% client-side**, igual que el buscador ya existente: no
se toca `useClientes.ts` ni RLS. RLS ya determina qué filas llegan al
navegador según el permiso del usuario (`view` propio vs `view_all`
todos); el filtro de vendedor solo acota, en el cliente, lo que ya se
recibió.

### `app/pages/clientes/index.vue`

Se agrega la carga de usuarios (mismo patrón que
`admin/auditoria/index.vue`):

```ts
const { fetchUsuarios } = useUsuarios()
const usuarios = ref<Usuario[]>([])

onMounted(async () => {
  clientes.value = await fetchClientes()
  usuarios.value = await fetchUsuarios()
  cargando.value = false
})
```

Y se pasa `:usuarios="usuarios"` a `<ClientesClienteSplitView>`.

### `app/components/clientes/ClienteSplitView.vue`

Nueva prop `usuarios: Usuario[]`, nuevo estado `filtroVendedor = ref('')`
con tres estados posibles: `''` (todos), `'sin_asignar'` (owner_id es
`null`), o el `id` de un usuario. El `<select>` va junto al buscador de
texto ya existente, arriba de la lista, mismo estilo Tailwind que los
selects de filtro de productos/auditoría
(`border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none
focus:ring-2 focus:ring-[#1075B5]/30`).

`clientesFiltrados` combina ambos filtros con AND (búsqueda de texto Y
vendedor), igual que el patrón ya usado en productos:

```ts
const clientesFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  return props.clientes.filter((c) => {
    if (q && !c.razon_social.toLowerCase().includes(q) && !(c.nombre_contacto ?? '').toLowerCase().includes(q)) return false
    if (filtroVendedor.value === 'sin_asignar' && c.owner_id !== null) return false
    if (filtroVendedor.value && filtroVendedor.value !== 'sin_asignar' && c.owner_id !== filtroVendedor.value) return false
    return true
  })
})
```

## Fuera de alcance

- Sin otros filtros (RUT, fecha, estado de tickets, etc.) — solo
  vendedor asignado.
- Sin cambios a `useClientes.ts`, `useUsuarios.ts` ni RLS.
- Sin gating de permisos adicional en el filtro: se muestra siempre
  (para un usuario con permiso `view` únicamente, la lista ya viene
  acotada a sus propios clientes por RLS, así que el filtro es trivial
  pero inofensivo en ese caso).

## Testing (manual, sin suite automatizada)

1. Sin filtro de vendedor (opción "Todos"): se ven todos los clientes
   que RLS ya permite ver.
2. Elegir un vendedor específico: solo aparecen sus clientes.
3. Elegir "Sin asignar": solo aparecen clientes con `owner_id` nulo.
4. Combinar búsqueda de texto + filtro de vendedor: el resultado
   respeta ambos (AND).
5. Volver a "Todos": la lista vuelve a mostrar todo.
