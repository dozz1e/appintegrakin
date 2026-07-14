# Menú de usuario, perfil editable y configuración (2026-07-13)

## Contexto

El header (`app/layouts/default.vue`) muestra hoy avatar + nombre + rol
como texto estático, y un botón "Salir" aparte. No hay forma de que un
usuario edite su propio nombre, suba una foto, ni configure nada del CRM
(por ejemplo el umbral de aviso de tareas próximas a vencer, hoy fijo en
30 min vía `UMBRAL_MINUTOS_PROXIMAS` en `useTareas.ts`).

Se pide: clickear el nombre del usuario abre un menú con Perfil,
Configuración y Salir. Perfil permite editar nombre y foto. Configuración
arranca con un solo campo (umbral de aviso de alerts) pero debe quedar
preparada para agregar más configuraciones después sin rehacer el modal.

## Alcance

Dentro:
- Menú desplegable en el header, disparado al clickear avatar+nombre.
- Modal de perfil: editar `full_name` y foto de perfil.
- Modal de configuración: editar umbral de minutos de aviso de
  `RecordatorioAlert`.
- Botón "Salir" se mueve dentro del menú (deja de estar suelto en el header).

Fuera de alcance (no pedido, no se implementa):
- Cambio de contraseña o email (son de auth, no de este flujo).
- Teléfono u otros campos de perfil.
- Cualquier configuración más allá del umbral de alertas — el modal queda
  listo para crecer, pero no se agregan campos especulativos.

## Base de datos

Migración `profiles_avatar_settings`:

```sql
alter table profiles add column avatar_url text;
alter table profiles add column settings jsonb not null default '{}';
```

No requiere política RLS nueva: `profiles_update_own` (migración
`20260702000900_rls_profiles.sql:18-19`) ya permite a cada usuario
actualizar su propia fila (`id = auth.uid()`), y el trigger
`proteger_cambio_rol` solo bloquea `role_id`/`active`, no estas columnas
nuevas.

`settings` es un jsonb libre para futuras configuraciones de usuario, sin
necesitar migración por cada campo nuevo. Primer (y único, por ahora) key:
`umbral_alertas_minutos` (number). Si no está presente, se asume `30`
(mismo default actual) — no se escribe un valor por default en la fila,
se resuelve en código al leer.

### Storage: bucket `perfiles-imagenes`

Mismo patrón que `clientes-imagenes`
(`supabase/migrations/20260712000000_imagen_cliente.sql`), pero la
escritura se gatea por **path propio**, no por permiso de recurso — una
foto de perfil es personal, no depende de `has_permission`.

```sql
insert into storage.buckets (id, name, public)
values ('perfiles-imagenes', 'perfiles-imagenes', true)
on conflict (id) do nothing;

create policy perfiles_imagenes_select on storage.objects
for select using (bucket_id = 'perfiles-imagenes');

create policy perfiles_imagenes_insert on storage.objects
for insert with check (
  bucket_id = 'perfiles-imagenes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy perfiles_imagenes_update on storage.objects
for update using (
  bucket_id = 'perfiles-imagenes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy perfiles_imagenes_delete on storage.objects
for delete using (
  bucket_id = 'perfiles-imagenes'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

Convención de path al subir: `${auth.uid()}/${Date.now()}-${archivo.name}`
(igual que `subirImagenCliente`, pero con el id del propio usuario como
carpeta en vez del id del cliente — es lo que habilita la política).

## Composables

### `useMiPerfil.ts` (extender)

- `MiPerfil` gana `id: string`, `avatar_url: string | null`,
  `settings: Record<string, unknown>`.
- `cargarMiPerfil` selecciona las columnas nuevas.
- Nueva función `actualizarMiPerfil(payload: { full_name?: string;
  avatar_url?: string })`: hace `update` sobre `profiles` filtrando por
  `id = user.value.sub`, y refresca `perfil.value` con el resultado.
- Nueva función `actualizarConfiguracion(patch: Record<string,
  unknown>)`: hace merge (`{ ...perfil.value.settings, ...patch }`) y
  actualiza la columna `settings` completa (no hay `jsonb_set` parcial
  desde el cliente — se manda el objeto completo ya mergeado). Refresca
  `perfil.value`.
- Nueva función `subirFotoPerfil(archivo: File)`: sube a
  `perfiles-imagenes/${id}/...` y devuelve la URL pública, igual patrón
  que `subirImagenCliente` en `useClientes.ts:127-134`.

### `useTareas.ts` (ajustar)

- `UMBRAL_MINUTOS_PROXIMAS` deja de ser una constante de módulo fija.
  `refrescarTareasProximas` pasa a leer el umbral desde
  `useMiPerfil().perfil.value?.settings?.umbral_alertas_minutos ?? 30`
  en el momento de calcular, así cualquier cambio en configuración aplica
  en el próximo poll (máx. 60s) sin recargar la página.

## Componentes UI

### `SharedUserMenu.vue` (nuevo)

Reemplaza en el header el bloque de avatar+nombre+rol+botón "Salir"
sueltos. Mismo patrón de dropdown que `NotificationBell.vue`: `ref
abierto`, contenedor con click-fuera, `<Teleport>` no hace falta (no es
overlay de body, es dropdown normal con `position: absolute`).

```
<button @click="abierto = !abierto">
  avatar + nombre + rol (contenido actual, sin cambios visuales)
</button>
<div v-if="abierto" class="absolute ...">
  <header del dropdown: avatar grande, nombre, email>
  <button @click="abrirPerfil">Perfil</button>
  <button @click="abrirConfiguracion">Configuración</button>
  <hr>
  <button @click="logout">Salir</button>
</div>
```

Los modales (`PerfilModal`, `ConfiguracionModal`) se montan como
hermanos del dropdown, controlados por refs `perfilAbierto` /
`configuracionAbierta` en el propio `SharedUserMenu.vue`.

### `PerfilModal.vue` (nuevo)

Modal simple (overlay + card centrada, no hay overlay compartido
genérico en el proyecto todavía — se construye uno mínimo reutilizable
por los dos modales de este feature, ver Nota de reuso abajo).

Campos:
- Foto: círculo con preview (avatar actual o iniciales si no hay foto),
  botón "Cambiar foto" → input file oculto → `subirFotoPerfil` +
  `actualizarMiPerfil({ avatar_url })` inmediato al elegir archivo (no
  se pisa la subida detrás de un submit separado, un solo paso).
- Nombre: input de texto, editable.
- Email: texto de solo lectura (gris, sin input).
- Rol: badge de solo lectura (mismo estilo que otros badges de estado).
- Botón "Guardar" → `actualizarMiPerfil({ full_name })`, toast de éxito,
  cierra modal.

### `ConfiguracionModal.vue` (nuevo)

- Campo: "Avisar tareas próximas con anticipación de ___ minutos" (input
  number, min 1).
- Botón "Guardar" → `actualizarConfiguracion({ umbral_alertas_minutos:
  Number(valor) })`, toast, cierra modal.
- Valor inicial: `perfil.value?.settings?.umbral_alertas_minutos ?? 30`.

### Nota de reuso: modal base

No existe hoy un componente de modal genérico (`SharedConfirmDialog` es
específico para confirmaciones sí/no, no sirve para formularios). Se
crea `SharedModal.vue` mínimo (overlay + card + slot + botón cerrar X),
usado por `PerfilModal` y `ConfiguracionModal`. No se migra
`SharedConfirmDialog` a usarlo — fuera de alcance, no lo pidieron y
funciona bien como está.

## Testing / verificación manual

1. Clickear nombre en el header → abre dropdown con Perfil, Configuración,
   Salir.
2. Click afuera del dropdown → cierra.
3. Perfil → cambiar nombre, guardar → el nombre en el header se actualiza
   sin recargar.
4. Perfil → subir foto → avatar en el header cambia a la foto subida.
5. Configuración → cambiar umbral a 5 minutos, guardar → crear una tarea
   que vence en 4 minutos → el alert aparece en el siguiente poll (≤60s)
   sin haber aparecido antes con el umbral de 30.
6. Salir desde el menú → cierra sesión igual que el botón anterior.
7. Build (`npm run build`) sin errores.
