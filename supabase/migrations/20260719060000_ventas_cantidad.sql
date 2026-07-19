-- supabase/migrations/20260719060000_ventas_cantidad.sql

alter table public.ventas
  add column cantidad integer not null default 1;

alter table public.ventas
  add constraint ventas_cantidad_check check (cantidad > 0);
