# Hardening storage buckets (hallazgos 5-6) — Design Spec

**Fecha:** 2026-07-19

## Contexto

Continuación de la auditoría RLS (`docs/superpowers/specs/2026-07-19-hardening-rpc-permisos-design.md`,
hallazgos 1-4 ya cerrados). Quedan dos hallazgos sobre `storage.objects`:

- **Hallazgo 5** (`get_advisors` security, `public_bucket_allows_listing`):
  `clientes-imagenes`, `entidad-imagenes`, `perfiles-imagenes` tienen policy
  `SELECT` amplia (`bucket_id = 'x'`) en `storage.objects`. Los 3 son buckets
  públicos — el acceso a un objeto vía `getPublicUrl()` no pasa por RLS de
  `storage.objects` en absoluto (Supabase lo sirve directo). Confirmado por
  grep: el frontend nunca llama `.list()`/`.download()`, solo `.upload()` +
  `.getPublicUrl()`. La policy `SELECT` solo habilita la API de *listado*
  (`storage.from(bucket).list()`), que cualquiera con la anon key puede
  invocar para enumerar todos los archivos del bucket.

- **Hallazgo 6** (no capturado por el advisor automático, encontrado al
  revisar las policies de `entidad-imagenes`): su policy `DELETE` en
  `storage.objects` es `bucket_id = 'entidad-imagenes' AND auth.uid() is not
  null` — sin chequeo de dueño. La tabla `entidad_imagenes` sí filtra el
  borrado de la fila por `created_by = auth.uid()`
  (`delete_entidad_imagenes_propias`), pero el archivo físico en Storage se
  puede borrar por API directa (fuera de la app) sin importar quién lo subió.
  `clientes-imagenes` y `perfiles-imagenes` no tienen este problema:
  `clientes_imagenes_delete` exige `has_permission(..., 'clientes', 'edit')`
  y `perfiles_imagenes_delete` exige que la carpeta del path sea el propio
  `auth.uid()`.

## Fix

**Hallazgo 5:** eliminar las 3 policies `SELECT` de `storage.objects`
(`clientes_imagenes_select`, `entidad_imagenes_storage_select`,
`perfiles_imagenes_select`). Sin impacto funcional — `getPublicUrl()` sigue
sirviendo los objetos igual, solo se cierra la API de listado.

**Hallazgo 6:** reemplazar `entidad_imagenes_storage_delete` para exigir que
el path del archivo (`storage.foldername(name)`: `[1]` = `entidad_tipo`,
`[2]` = `entidad_id`, mismo formato que arma `subirImagen()` en
`useEntidadImagenes.ts:29`) corresponda a una fila de `entidad_imagenes` con
`created_by = auth.uid()`, **o** que el caller sea superadmin (mismo patrón
de bypass que el resto de funciones de permisos, gotcha #15 de
`CONTEXTO_PROYECTO.md`):

```sql
create policy entidad_imagenes_storage_delete
  on storage.objects for delete
  using (
    bucket_id = 'entidad-imagenes'
    and (
      exists (select 1 from superadmins where user_id = auth.uid())
      or exists (
        select 1 from entidad_imagenes ei
        where ei.entidad_tipo = (storage.foldername(name))[1]
          and ei.entidad_id = (storage.foldername(name))[2]::uuid
          and ei.created_by = auth.uid()
      )
    )
  );
```

## Alcance

Solo `storage.objects` (4 policies: 3 `SELECT` eliminadas, 1 `DELETE`
reemplazada). No toca `clientes_imagenes_delete`/`perfiles_imagenes_delete`
(ya correctas) ni ninguna tabla de aplicación.

## Testing

- `select policyname from pg_policies where schemaname='storage' and
  tablename='objects'` — confirmar que las 3 `SELECT` ya no existen y que
  `entidad_imagenes_storage_delete` tiene la nueva definición.
- PoC: impersonar un usuario no-superadmin sin fila propia en
  `entidad_imagenes` para un path dado, confirmar que el delete no aplica
  (0 filas afectadas en `storage.objects` bajo ese rol) — mismo mecanismo de
  impersonación (`set local role`/`set local request.jwt.claims`) ya usado
  en la auditoría original.
- Verificación manual (usuario): subir/ver una imagen en una interacción de
  cliente y en un ticket post-venta — confirmar que se sigue viendo
  normalmente (URL pública sin cambios).
