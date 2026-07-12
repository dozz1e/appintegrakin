-- supabase/migrations/20260712000000_imagen_cliente.sql
--
-- Bucket público porque son fotos/logos de clientes B2B, no datos
-- sensibles — permite servir la imagen con <img src> directo a la URL
-- pública sin pasar por el cliente de Supabase. La escritura queda
-- gateada por el mismo permiso que ya protege UPDATE de la fila
-- (clientes.edit), sin reimplementar la distinción propio/todos
-- (view/view_all) porque storage.objects no tiene noción de owner_id.

insert into storage.buckets (id, name, public)
values ('clientes-imagenes', 'clientes-imagenes', true)
on conflict (id) do nothing;

create policy clientes_imagenes_select on storage.objects
for select using (bucket_id = 'clientes-imagenes');

create policy clientes_imagenes_insert on storage.objects
for insert with check (
  bucket_id = 'clientes-imagenes'
  and has_permission(auth.uid(), 'clientes', 'edit')
);

create policy clientes_imagenes_update on storage.objects
for update using (
  bucket_id = 'clientes-imagenes'
  and has_permission(auth.uid(), 'clientes', 'edit')
);

create policy clientes_imagenes_delete on storage.objects
for delete using (
  bucket_id = 'clientes-imagenes'
  and has_permission(auth.uid(), 'clientes', 'edit')
);

alter table clientes add column imagen_url text;
