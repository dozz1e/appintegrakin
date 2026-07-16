# Editar interacciones y tareas/recordatorios

## Contexto

Hoy interacciones (clientes/leads) y tareas solo soportan crear +
eliminar (el borrado de interacciones se arregló recién, ver
`docs/superpowers/specs/2026-07-16-...` — commit `498b807`). Se pide
poder **editar** las tres cosas. Investigación confirma que "recordatorio"
no es una entidad separada: `RecordatorioAlert` lee directo de la tabla
`tareas` (`useTareas().tareasProximas`), así que un solo feature de
edición sobre `tareas` cubre tareas y recordatorios a la vez.

Estado actual relevante (código real, revisado):
- `app/composables/useClienteInteracciones.ts` / `useLeadInteracciones.ts`:
  sin función de edición. Interfaces `ClienteInteraccion`/`LeadInteraccion`
  sin columna `updated_at`.
- `supabase/migrations/20260714040000_cliente_interacciones.sql` /
  `20260705000100_lead_interacciones.sql`: sin policy de `update` (solo
  `select`/`insert`). Si se agrega `actualizarInteraccion` sin migrar
  RLS primero, el update queda bloqueado en silencio (mismo gotcha del
  delete, ver gotcha #18 de `CONTEXTO_PROYECTO.md`).
- `app/composables/useTareas.ts`: sin función de edición. `Tarea.updated_at`
  sí existe como columna pero sin trigger — se actualiza a mano
  (`marcarCompletada` ya lo hace explícito). Policy `update_tareas`
  (`20260705000000_tareas.sql:36-40`) ya tiene el criterio correcto
  (`owner_id = auth.uid() or has_permission(..., 'tareas', 'view_all')`)
  — **no requiere migración nueva**.
- `ClienteInteraccionTimeline.vue` / `LeadTimeline.vue`: form de "agregar"
  inline arriba (select canal + input nota), lista con botón de borrar
  (✕/tacho) recién agregado. Sin ningún patrón de edición inline hoy.
- `TareaList.vue`: form de "agregar" inline (titulo + fecha + hora),
  lista con checkbox completada + botón borrar. Sin edición hoy.

## Diseño

**UI: edición inline, sin modal nuevo.** Al tocar el lápiz de una fila,
esa fila se reemplaza por los mismos inputs que ya usa el form de
"agregar" (mismo estilo, misma validación), con botones Guardar/Cancelar
en vez de Agregar. Un solo `ref` por componente (`idEditando: string | null`)
controla qué fila está en modo edición — solo una a la vez.

### Interacciones — migración RLS

```sql
-- supabase/migrations/20260716050000_update_interacciones_permiso.sql
create policy update_interacciones_propias_cliente
  on cliente_interacciones for update
  using (created_by = auth.uid() or has_permission(auth.uid(), 'clientes', 'edit'));

create policy update_interacciones_propias_lead
  on lead_interacciones for update
  using (created_by = auth.uid() or has_permission(auth.uid(), 'leads', 'edit'));
```

Mismo criterio que la policy de `delete` ya arreglada (creador o
`clientes.edit`/`leads.edit`) — no repetir el bug del delete original.

### `useClienteInteracciones.ts` / `useLeadInteracciones.ts`

Nueva función `actualizarInteraccion(id, canal, nota)`, mismo patrón
defensivo que `eliminarInteraccion` (chequear filas afectadas, no
confiar en "sin error" = "se guardó"):

```ts
async function actualizarInteraccion(
  id: string,
  canal: ClienteInteraccion['canal'],
  nota: string
): Promise<ClienteInteraccion> {
  const { data, error } = await supabase
    .from('cliente_interacciones')
    .update({ canal, nota })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
```

(`.single()` ya tira error si 0 filas — no hace falta el chequeo manual
de `eliminarInteraccion`, que usaba `.select()` sin `.single()` porque
ahí no había fila para devolver de vuelta.)

Espejo idéntico en `useLeadInteracciones.ts` (`lead_interacciones`,
`LeadInteraccion`).

### `ClienteInteraccionTimeline.vue` / `LeadTimeline.vue`

- Nuevo estado: `idEditando = ref<string | null>(null)`, `canalEditado = ref('')`, `notaEditada = ref('')`.
- Botón lápiz (`Icon name="mdi:pencil-outline"`) junto al de borrar
  existente, mismo estilo (`text-gray-300 hover:text-primary shrink-0`).
  Al click: `idEditando.value = i.id; canalEditado.value = i.canal; notaEditada.value = i.nota`.
- Cuando `idEditando === i.id`: en vez de mostrar `SharedBadge` +
  `SharedTextoExpandible` de esa fila, mostrar los mismos
  `<select v-model="canalEditado">` (mismas 6 opciones que el form de
  agregar) + `<input v-model="notaEditada">`, más botones
  "Guardar"/"Cancelar".
- Guardar: `await actualizarInteraccion(i.id, canalEditado.value, notaEditada.value)`,
  reemplazar el item en `interacciones.value` con la respuesta, cerrar
  edición (`idEditando.value = null`), toast de éxito. Cancelar: solo
  `idEditando.value = null`, sin llamada a la API.
- La imagen (`SharedGaleriaImagenes`) y la fecha no son editables — se
  siguen mostrando igual, fuera del modo edición.

### Tareas — sin migración RLS (ya soportado)

### `useTareas.ts`

```ts
async function actualizarTarea(
  id: string,
  titulo: string,
  fechaVencimiento: string | null
): Promise<Tarea> {
  const { data, error } = await supabase
    .from('tareas')
    .update({ titulo, fecha_vencimiento: fechaVencimiento, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
```

### `TareaList.vue`

- Mismo patrón: `idEditando = ref<string | null>(null)`, más `tituloEditado`/`fechaEditada`/`horaEditada`.
- Botón lápiz junto al de borrar en cada `<li>`.
- En modo edición, la fila muestra los mismos inputs del form de
  "agregar" (texto + date + time), reutilizando `construirFechaVencimiento`
  para combinar fecha+hora igual que al crear (mismo default 23:59 si
  falta hora, gotcha #11 de `CONTEXTO_PROYECTO.md`).
- Guardar llama `actualizarTarea(t.id, tituloEditado.value.trim(), fechaEditada.value ? construirFechaVencimiento(...) : null)`,
  reemplaza el item en `tareas.value`, cierra edición. Cancelar solo
  cierra sin llamar nada.
- `completada` no se edita desde acá (sigue siendo el checkbox
  existente, sin cambios).
- Cubre recordatorios automáticamente: al guardar, la próxima vez que
  `refrescarTareasProximas` corra (polling de 60s o próxima carga), el
  aviso ya refleja el título/fecha nuevos — no hace falta tocar
  `RecordatorioAlert.vue` ni `RecordatorioAlertContainer.vue`.

## Fuera de alcance

- No se agrega `updated_at` a `cliente_interacciones`/`lead_interacciones`
  (no se pidió mostrar "editado hace X", solo poder editar).
- No se permite editar `completada`, `owner_id` ni `entidad_tipo`/`entidad_id`
  de una tarea desde este formulario — solo título y fecha/hora.
- No se agrega historial de ediciones (a diferencia de `audit_log`, que
  sí audita `clientes`/`leads`/`tickets`/`productos`/`ventas` pero no
  `tareas` ni las tablas de interacciones — se mantiene así).
- Solo una fila editable a la vez por componente (no edición múltiple
  simultánea).

## Testing (manual, sin suite automatizada)

1. Editar una interacción propia (cliente y lead): cambiar canal y
   nota, guardar, confirmar que se actualiza y persiste al recargar.
2. Editar una interacción ajena con `clientes.edit`/`leads.edit`:
   funciona igual (mismo criterio que el delete ya arreglado).
3. Editar una interacción ajena SIN ese permiso: debe fallar con error
   claro (RLS bloquea, `.single()` tira error), no un falso éxito.
4. Cancelar edición de una interacción: no cambia nada, la fila vuelve
   a mostrar los datos originales.
5. Editar una tarea: cambiar título y fecha/hora, guardar, confirmar
   que se refleja en la lista y en el popup de `RecordatorioAlert` si
   está dentro del umbral configurado.
6. Cancelar edición de una tarea: sin cambios.
7. Solo una fila editable a la vez: abrir edición en una fila, tocar el
   lápiz de otra — la primera se cierra sin guardar (un solo `ref`
   compartido, se sobrescribe al abrir la segunda).
