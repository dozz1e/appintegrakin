-- Primera conexión de productos con otra entidad: registra una venta de
-- un producto del catálogo a un cliente. owner_id = vendedor que la
-- registró, mismo patrón que tickets (propio vs view_all) - ver
-- docs/superpowers/specs/2026-07-13-ventas-cliente-design.md

create table ventas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  producto_id uuid not null references productos(id),
  valor numeric not null,
  fecha timestamptz not null,
  owner_id uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create index idx_ventas_cliente on ventas(cliente_id);
create index idx_ventas_producto on ventas(producto_id);

create trigger trg_ventas_version before update on ventas
  for each row execute function fn_incrementar_version();

create trigger audit_ventas after insert or update or delete on ventas
  for each row execute function registrar_auditoria();
