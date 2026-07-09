-- Timeline de interacciones (correo/texto/teléfono) por lead.
-- Migración retroactiva: la tabla ya existía en la base real (creada a mano
-- en el SQL Editor de Supabase); este archivo documenta y versiona ese
-- esquema tal como está desplegado hoy.

create table lead_interacciones (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  canal text check (canal in ('correo','texto','telefono')) not null,
  nota text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table lead_interacciones enable row level security;

-- ReBAC: visibilidad heredada de leads (el propio RLS de `leads` filtra
-- qué lead_id son visibles para el usuario que hace la subconsulta).
create policy select_interacciones_si_ve_lead on lead_interacciones
for select using (
  exists (select 1 from leads l where l.id = lead_interacciones.lead_id)
);

create policy insert_interacciones_si_ve_lead on lead_interacciones
for insert with check (
  exists (select 1 from leads l where l.id = lead_interacciones.lead_id)
  and created_by = auth.uid()
);
