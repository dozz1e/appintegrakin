# Fecha y hora en tareas/recordatorios

## Contexto

Pedido del usuario: agregar un selector de hora ("reloj") a las tareas y
recordatorios, y mejorar el selector de fecha con un calendario, para dar
mejor aviso de cuándo se cumple la tarea.

`app/components/shared/TareaList.vue` es el componente compartido que
muestra el formulario de "Tareas y recordatorios" en las tres entidades
(`clientes/[id].vue`, `leads/[id].vue`, `tickets/[id].vue`, vía
`SharedTareaList :entidad-tipo="..."`). Hoy el formulario tiene un único
`<input type="date">` nativo (`TareaList.vue:76-80`) — sin hora. Como el
navegador manda solo la fecha, Postgres la interpreta como medianoche del
día elegido, así que una tarea "para hoy" ya se considera vencida (`esVencida`,
`TareaList.vue:57-59`) apenas empieza el día. Esto también afecta
directamente la notificación automática `tarea_vencida` vía `pg_cron`
recién implementada ([[2026-07-10-notificacion-tarea-vencida-design]]),
que revisa `fecha_vencimiento < now()` cada hora.

`tareas.fecha_vencimiento` ya es `timestamptz` — soporta hora completa sin
cambios de schema. Este es un cambio puramente de frontend.

## Decisiones de producto (validadas con el usuario)

1. **Alcance: las tres entidades.** Como `TareaList.vue` es un componente
   compartido, el cambio aplica por igual a clientes, leads y tickets — no
   se bifurca el comportamiento por tipo de entidad.
2. **Inputs nativos, sin librería nueva.** `<input type="date">` +
   `<input type="time">` nativos, uno al lado del otro. Se descarta una
   librería de datepicker (ej. `vue-datepicker`) — los inputs nativos ya
   dan calendario/reloj emergente en todos los navegadores modernos, sin
   agregar una dependencia nueva ni superficie de mantenimiento extra.
3. **Hora por defecto: `23:59` del día elegido, si se deja vacía.** Corrige
   el bug actual (vencimiento instantáneo a medianoche) sin forzar a elegir
   una hora exacta para el caso común de "tarea para tal día".
4. **Mostrar la hora en el listado solo si no es el default.** Si la hora
   local del timestamp es exactamente `23:59`, se muestra igual que hoy
   (`"08 jul"`); en cualquier otro caso se agrega la hora (`"08 jul,
   14:30"`), para no mostrar un `23:59` que la persona nunca eligió.

## Diseño

### Combinar fecha + hora en un timestamp correcto

`TareaList.vue` agrega un segundo `ref` (`horaVencimiento`) y un segundo
input (`type="time"`) junto al de fecha ya existente. Al enviar
(`onSubmit`), si hay fecha:

```ts
function construirFechaVencimiento(fecha: string, hora: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const [horas, minutos] = hora ? hora.split(':').map(Number) : [23, 59]
  return new Date(anio, mes - 1, dia, horas, minutos, 0).toISOString()
}
```

Se usa `new Date(anio, mes, dia, horas, minutos)` (constructor de
componentes, no `new Date(string)`) para que el navegador interprete la
fecha/hora en la zona horaria local de quien la ingresa, igual que
`updateLead`/`updateCliente`/`updateTicket` ya hacen con
`new Date().toISOString()` para `updated_at` — mismo patrón, ya presente
en el código, no una convención nueva.

Si no hay fecha, `fecha_vencimiento` sigue siendo `null` (sin cambios). Si
hay hora pero no fecha, la hora se ignora — no tiene sentido un horario sin
día. `crearTarea()` en `useTareas.ts` no cambia de firma; sigue recibiendo
un `string | null` para `fechaVencimiento`, ahora ya combinado.

### Formulario

```html
<input v-model="fechaVencimiento" type="date" ... />
<input v-model="horaVencimiento" type="time" ... />
```

Mismas clases Tailwind que el input de fecha actual, mismo tamaño. Al
limpiar el formulario tras crear la tarea (`titulo.value = ''` /
`fechaVencimiento.value = ''`), también se limpia `horaVencimiento.value =
''`.

### Mostrar la hora en el listado

`formatearFecha` deja de recibir solo el string de fecha y pasa a recibir
la tarea completa (o el string + un booleano ya calculado), para poder
decidir si la hora local es el default:

```ts
function formatearFecha(fecha: string) {
  const d = new Date(fecha)
  const esDefault = d.getHours() === 23 && d.getMinutes() === 59
  const base = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
  if (esDefault) return base
  return `${base}, ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
}
```

Sin cambios en el template más allá de seguir llamando
`formatearFecha(t.fecha_vencimiento)` — la función ya tiene todo lo que
necesita en el string del timestamp.

## Fuera de alcance

- No se toca `useTareas.ts` — `crearTarea` sigue recibiendo un
  `string | null`, el cambio es enteramente de cómo `TareaList.vue`
  construye ese string antes de pasarlo.
- No se agrega librería de terceros (datepicker) — decisión explícita,
  ver arriba.
- No se cambia el schema (`tareas.fecha_vencimiento` ya es `timestamptz`).
- No se toca la notificación `tarea_vencida` ni el cron — este cambio
  mejora la precisión de los datos que esa función ya consume, sin
  modificar su lógica.
- No se agrega edición de la hora de una tarea ya creada — igual que hoy,
  una tarea creada no se puede editar (solo completar/marcar), no es parte
  de este pedido.
- No se valida que la fecha/hora elegida esté en el futuro — igual que
  hoy, se puede crear una tarea con fecha pasada (por ejemplo, para
  registrar algo retroactivo).

## Testing (manual, sin suite automatizada aún)

1. Crear una tarea con fecha de hoy y sin hora. Confirmar que se guarda
   como `23:59` de hoy (no vencida hasta el final del día) y que el
   listado muestra solo la fecha, sin hora.
2. Crear una tarea con fecha de hoy y hora en el pasado (ej. hace 5
   minutos). Confirmar que aparece inmediatamente marcada como vencida
   (fondo rojo, `esVencida`) y que el listado muestra `"<fecha>, <hora>"`.
3. Crear una tarea con fecha futura y una hora específica. Confirmar que
   el listado muestra la hora elegida correctamente (verificar que
   coincide con lo ingresado, no desplazada por zona horaria).
4. Repetir los 3 casos anteriores en las tres páginas de detalle
   (`/clientes/[id]`, `/leads/[id]`, `/tickets/[id]`) — mismo componente
   compartido, confirmar que se comporta igual en las tres.
5. Confirmar que una tarea sin fecha (campo vacío) se sigue creando sin
   `fecha_vencimiento`, igual que hoy.
