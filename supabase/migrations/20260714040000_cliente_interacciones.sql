-- Timeline de interacciones (mismo concepto que lead_interacciones, pero
-- para clientes ya convertidos) - permite registrar fecha/hora de cada
-- contacto y calcular "última interacción" para listar/filtrar clientes.

create table cliente_interacciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  canal text check (canal in ('whatsapp', 'instagram', 'facebook', 'llamada', 'web', 'correo')) not null,
  nota text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_cliente_interacciones_cliente on cliente_interacciones(cliente_id, created_at desc);

alter table cliente_interacciones enable row level security;

-- ReBAC: visibilidad heredada de clientes (el propio RLS de `clientes` filtra
-- qué cliente_id son visibles para el usuario que hace la subconsulta),
-- mismo patrón que select_interacciones_si_ve_lead.
create policy select_interacciones_si_ve_cliente on cliente_interacciones
for select using (
  exists (select 1 from clientes c where c.id = cliente_interacciones.cliente_id)
);

create policy insert_interacciones_si_ve_cliente on cliente_interacciones
for insert with check (
  exists (select 1 from clientes c where c.id = cliente_interacciones.cliente_id)
  and created_by = auth.uid()
);
