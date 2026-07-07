-- Tablas núcleo del MVP: clientes, leads, tickets de servicio técnico

create table clientes (
  id uuid primary key default gen_random_uuid(),
  rut text unique,
  razon_social text not null,
  nombre_contacto text,
  telefono text,
  email text,
  kame_id text,              -- vínculo con registro en Kame ERP (solo lectura por ahora)
  owner_id uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  email text,
  origen text,                -- 'whatsapp' | 'web' | 'referido' | 'otro'
  estado text check (estado in ('nuevo','contactado','cotizado','negociacion','ganado','perdido')) default 'nuevo',
  cliente_id uuid references clientes(id),
  owner_id uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) not null,
  titulo text not null,
  descripcion text,
  estado text check (estado in ('abierto','en_proceso','esperando_cliente','resuelto','cerrado')) default 'abierto',
  prioridad text check (prioridad in ('baja','media','alta','urgente')) default 'media',
  owner_id uuid references profiles(id),   -- técnico asignado
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_clientes_owner on clientes(owner_id);
create index idx_leads_owner on leads(owner_id);
create index idx_leads_estado on leads(estado);
create index idx_tickets_cliente on tickets(cliente_id);
create index idx_tickets_owner on tickets(owner_id);
create index idx_tickets_estado on tickets(estado);
