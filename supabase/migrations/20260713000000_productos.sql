-- Catálogo de productos: sin owner_id (no es "propiedad" de un vendedor,
-- es un catálogo compartido) — ver
-- docs/superpowers/specs/2026-07-12-productos-catalogo-design.md

create table productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  sku text not null unique,
  categoria text,
  unidad_medida text,
  estado text check (estado in ('activo','inactivo')) default 'activo',
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  version integer not null default 1
);

create index idx_productos_categoria on productos(categoria);
create index idx_productos_estado on productos(estado);

create trigger trg_productos_version before update on productos
  for each row execute function fn_incrementar_version();

create trigger audit_productos after insert or update or delete on productos
  for each row execute function registrar_auditoria();
