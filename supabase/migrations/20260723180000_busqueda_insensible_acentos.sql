-- supabase/migrations/20260723180000_busqueda_insensible_acentos.sql
--
-- Los buscadores (clientes/leads/tickets) exigían coincidencia exacta de
-- mayúsculas/acentos vía ilike sobre columnas crudas. unaccent() es STABLE
-- (depende del search_path), así que no se puede usar directo en una
-- columna generada/índice - se envuelve en una función marcada IMMUTABLE
-- fijando el diccionario explícitamente (patrón estándar para este caso).

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.inmutable_unaccent(input text)
returns text
language sql
immutable
strict
set search_path = extensions, public
as $$
  select unaccent('unaccent', input)
$$;

-- clientes: razon_social, nombre_contacto, telefono, email, rut
alter table public.clientes
  add column if not exists busqueda_normalizada text
  generated always as (
    lower(public.inmutable_unaccent(
      coalesce(razon_social, '') || ' ' ||
      coalesce(nombre_contacto, '') || ' ' ||
      coalesce(telefono, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(rut, '')
    ))
  ) stored;

create index if not exists idx_clientes_busqueda_normalizada
  on public.clientes using gin (busqueda_normalizada extensions.gin_trgm_ops);

-- leads: nombre, telefono, email
alter table public.leads
  add column if not exists busqueda_normalizada text
  generated always as (
    lower(public.inmutable_unaccent(
      coalesce(nombre, '') || ' ' ||
      coalesce(telefono, '') || ' ' ||
      coalesce(email, '')
    ))
  ) stored;

create index if not exists idx_leads_busqueda_normalizada
  on public.leads using gin (busqueda_normalizada extensions.gin_trgm_ops);

-- tickets: titulo, descripcion
alter table public.tickets
  add column if not exists busqueda_normalizada text
  generated always as (
    lower(public.inmutable_unaccent(
      coalesce(titulo, '') || ' ' ||
      coalesce(descripcion, '')
    ))
  ) stored;

create index if not exists idx_tickets_busqueda_normalizada
  on public.tickets using gin (busqueda_normalizada extensions.gin_trgm_ops);
