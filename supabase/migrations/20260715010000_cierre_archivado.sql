-- supabase/migrations/20260715010000_cierre_archivado.sql
--
-- Columnas fecha_cierre/archivado + trigger que las gestiona al entrar o
-- salir de un estado de cierre, por módulo. archivado lo pone en true un
-- cron aparte (ver 20260715030000_cron_archivar_cerrados.sql) - acá solo
-- se resetea a false si el registro se reabre. Ver spec
-- 2026-07-15-historial-estados-archivado-design.md.

alter table leads add column fecha_cierre timestamptz;
alter table leads add column archivado boolean not null default false;

alter table tickets add column fecha_cierre timestamptz;
alter table tickets add column archivado boolean not null default false;

alter table tickets_post_venta add column fecha_cierre timestamptz;
alter table tickets_post_venta add column archivado boolean not null default false;

create or replace function fn_gestionar_cierre_leads()
returns trigger
language plpgsql
as $$
begin
  if new.estado in ('ganado', 'perdido') and old.estado not in ('ganado', 'perdido') then
    new.fecha_cierre := now();
  elsif new.estado not in ('ganado', 'perdido') and old.estado in ('ganado', 'perdido') then
    new.fecha_cierre := null;
    new.archivado := false;
  end if;
  return new;
end;
$$;

create trigger gestionar_cierre_leads before update on leads
  for each row execute function fn_gestionar_cierre_leads();

create or replace function fn_gestionar_cierre_tickets()
returns trigger
language plpgsql
as $$
begin
  if new.estado in ('resuelto', 'cerrado') and old.estado not in ('resuelto', 'cerrado') then
    new.fecha_cierre := now();
  elsif new.estado not in ('resuelto', 'cerrado') and old.estado in ('resuelto', 'cerrado') then
    new.fecha_cierre := null;
    new.archivado := false;
  end if;
  return new;
end;
$$;

create trigger gestionar_cierre_tickets before update on tickets
  for each row execute function fn_gestionar_cierre_tickets();

create or replace function fn_gestionar_cierre_tickets_post_venta()
returns trigger
language plpgsql
as $$
begin
  if new.estado = 'despachado' and old.estado <> 'despachado' then
    new.fecha_cierre := now();
  elsif new.estado <> 'despachado' and old.estado = 'despachado' then
    new.fecha_cierre := null;
    new.archivado := false;
  end if;
  return new;
end;
$$;

create trigger gestionar_cierre_tickets_post_venta before update on tickets_post_venta
  for each row execute function fn_gestionar_cierre_tickets_post_venta();
