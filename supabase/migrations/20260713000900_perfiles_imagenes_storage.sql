-- supabase/migrations/20260713000900_perfiles_imagenes_storage.sql
--
-- Mismo patrón que clientes-imagenes (20260712000000_imagen_cliente.sql)
-- pero la escritura se gatea por path propio (carpeta = auth.uid()), no
-- por permiso de recurso: una foto de perfil es personal, no depende de
-- has_permission.

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
