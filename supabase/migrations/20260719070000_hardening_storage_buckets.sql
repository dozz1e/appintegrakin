-- supabase/migrations/20260719070000_hardening_storage_buckets.sql

drop policy clientes_imagenes_select on storage.objects;
drop policy entidad_imagenes_storage_select on storage.objects;
drop policy perfiles_imagenes_select on storage.objects;

drop policy entidad_imagenes_storage_delete on storage.objects;

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
