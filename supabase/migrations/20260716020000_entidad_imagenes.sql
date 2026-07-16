-- Galería de imágenes genérica para interacciones (cliente/lead) y tickets
-- (servicio técnico y post-venta). A diferencia de clientes.imagen_url
-- (una sola imagen), acá puede haber varias por registro - patrón
-- entidad_tipo/entidad_id ya usado en tareas/historial_estados.
--
-- storage.objects no tiene noción de a qué entidad pertenece cada archivo
-- (gotcha ya documentado con clientes-imagenes), así que el control real
-- de acceso queda en la tabla entidad_imagenes: cada policy verifica que
-- la fila padre exista, lo que cascada a través del RLS de esa tabla
-- padre (cliente_interacciones/lead_interacciones/tickets/
-- tickets_post_venta ya filtran por su propio criterio view/view_all).
-- El bucket en sí solo exige estar autenticado.

create table entidad_imagenes (
  id uuid primary key default gen_random_uuid(),
  entidad_tipo text not null check (entidad_tipo in ('cliente_interaccion', 'lead_interaccion', 'ticket', 'ticket_post_venta')),
  entidad_id uuid not null,
  url text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_entidad_imagenes_entidad on entidad_imagenes(entidad_tipo, entidad_id);

alter table entidad_imagenes enable row level security;

create policy select_entidad_imagenes on entidad_imagenes for select using (
  (entidad_tipo = 'cliente_interaccion' and exists (select 1 from cliente_interacciones ci where ci.id = entidad_imagenes.entidad_id)) or
  (entidad_tipo = 'lead_interaccion' and exists (select 1 from lead_interacciones li where li.id = entidad_imagenes.entidad_id)) or
  (entidad_tipo = 'ticket' and exists (select 1 from tickets t where t.id = entidad_imagenes.entidad_id)) or
  (entidad_tipo = 'ticket_post_venta' and exists (select 1 from tickets_post_venta tpv where tpv.id = entidad_imagenes.entidad_id))
);

create policy insert_entidad_imagenes on entidad_imagenes for insert with check (
  created_by = auth.uid() and (
    (entidad_tipo = 'cliente_interaccion' and exists (select 1 from cliente_interacciones ci where ci.id = entidad_imagenes.entidad_id)) or
    (entidad_tipo = 'lead_interaccion' and exists (select 1 from lead_interacciones li where li.id = entidad_imagenes.entidad_id)) or
    (entidad_tipo = 'ticket' and exists (select 1 from tickets t where t.id = entidad_imagenes.entidad_id)) or
    (entidad_tipo = 'ticket_post_venta' and exists (select 1 from tickets_post_venta tpv where tpv.id = entidad_imagenes.entidad_id))
  )
);

create policy delete_entidad_imagenes_propias on entidad_imagenes for delete using (created_by = auth.uid());

insert into storage.buckets (id, name, public)
values ('entidad-imagenes', 'entidad-imagenes', true)
on conflict (id) do nothing;

create policy entidad_imagenes_storage_select on storage.objects
for select using (bucket_id = 'entidad-imagenes');

create policy entidad_imagenes_storage_insert on storage.objects
for insert with check (bucket_id = 'entidad-imagenes' and auth.uid() is not null);

create policy entidad_imagenes_storage_delete on storage.objects
for delete using (bucket_id = 'entidad-imagenes' and auth.uid() is not null);
