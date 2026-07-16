# Permiso ventas.view_all para Natalia + filtro de vendedor en Leads

## Contexto

Natalia Quevedo es líder de vendedoras, además de tener los roles
`post_venta` y `servicio_tecnico`. Necesita ver `ventas.view_all` (hoy
solo tiene `ventas.view/create/edit` propio vía el rol `ventas`, que no
tiene). `leads.view_all` ya lo tiene gratis por unión de permisos (el
rol `post_venta` ya lo incluye, regla de "mayor permiso gana" del
modelo de permisos). Falta solo agregar `ventas.view_all` y dar un
selector de vendedor en la vista de Leads para que pueda filtrar por
cada vendedora (mismo patrón ya usado en Clientes, ver
`docs/superpowers/specs/2026-07-12-clientes-filtro-vendedor-design.md`).

Caso único hoy (una sola líder) — se resuelve con un override
individual en `user_permission_overrides`, no con un rol nuevo. Si en
el futuro aparecen más líderes de vendedoras, se evalúa migrar a un rol
`lider_ventas`.

## Parte A — permiso ventas.view_all (dato, no código)

Insert en `user_permission_overrides(user_id, permission_id, effect,
created_by)`:
- `user_id`: el de Natalia Quevedo (buscar en `profiles` por nombre/email).
- `permission_id`: el de `permissions(resource='ventas', action='view_all')`.
- `effect`: `'grant'`.
- `created_by`: null o el user_id de quien ejecuta (sistema).

Se hace directo por SQL (vía Supabase), ya que ya está validado con el
usuario. Alternativa disponible pero no usada: hacerlo a mano desde
`/admin/permisos`, la UI ya existe para esto.

## Parte B — selector de vendedor en Leads (código)

Mismo patrón que `ClienteSplitView.vue` (ver spec de clientes citada
arriba), pero gateado por `can('leads', 'view_all')` — a diferencia de
esa spec original, el filtro de clientes hoy también está gateado así
(ver Roadmap punto 21 de `CONTEXTO_PROYECTO.md`), así que se sigue el
estado actual del código, no el texto viejo de esa spec.

Estado actual relevante:
- `app/pages/leads/index.vue`: `onMounted` llama `fetchLeads()` una
  vez, guarda en `leads = ref<Lead[]>([])`. Ya existe `busqueda =
  ref('')` y un computed `leadsFiltrados` que filtra por nombre
  (líneas ~25-29). Pasa `leadsFiltrados` a `<LeadsLeadKanban>` (línea
  ~108).
- `Lead.owner_id: string | null` (`useLeads.ts`).
- `useUsuarios().fetchUsuarios()` ya se reutiliza sin cambios (mismo
  patrón que clientes/auditoría).
- `LeadKanban.vue` no necesita cambios — solo agrupa por `estado` el
  array que ya le llega filtrado.

Cambios en `app/pages/leads/index.vue`:

```ts
const { can } = usePermissions()
const { fetchUsuarios } = useUsuarios()
const usuarios = ref<Usuario[]>([])
const filtroVendedor = ref('')

onMounted(async () => {
  leads.value = await fetchLeads()
  usuarios.value = await fetchUsuarios()
})

const leadsFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  return leads.value.filter((l) => {
    if (q && !l.nombre.toLowerCase().includes(q)) return false
    if (filtroVendedor.value === 'sin_asignar' && l.owner_id !== null) return false
    if (filtroVendedor.value && filtroVendedor.value !== 'sin_asignar' && l.owner_id !== filtroVendedor.value) return false
    return true
  })
})
```

Template: `<select v-if="can('leads', 'view_all')" v-model="filtroVendedor">`
junto al input de búsqueda existente, mismas opciones y estilo Tailwind
que en `ClienteSplitView.vue` (`Todos los vendedores` / `Sin asignar` /
lista de usuarios).

## Fuera de alcance

- No se crea rol `lider_ventas` (caso único, override alcanza).
- No se toca `useLeads.ts`, `useVentas.ts` ni RLS.
- No se agrega filtro de vendedor a Tickets ni Post-venta (no pedido).

## Testing (manual, sin suite automatizada)

1. Natalia ve `ventas.view_all`: entra a Clientes → tab Ventas de un
   cliente ajeno y ve las ventas de otras vendedoras (no solo las
   propias).
2. En `/leads`, un usuario con `leads.view_all` ve el selector de
   vendedor; uno sin ese permiso no lo ve.
3. Elegir un vendedor específico: solo aparecen sus leads.
4. Elegir "Sin asignar": solo leads con `owner_id` nulo.
5. Combinar búsqueda de texto + filtro de vendedor: AND de ambos.
