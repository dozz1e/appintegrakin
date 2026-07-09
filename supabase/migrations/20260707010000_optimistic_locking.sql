-- Optimistic locking en leads, clientes, tickets: columna `version` que se
-- autoincrementa por trigger en cada UPDATE.
-- Migración retroactiva: ya estaba aplicada en la base real (corrida a mano
-- en el SQL Editor de Supabase); este archivo documenta y versiona ese
-- esquema tal como está desplegado hoy.
--
-- updateLead/updateCliente/updateTicket aceptan `expectedVersion` opcional;
-- si no matchea, lanzan Error('CONFLICTO_VERSION') (capturado en las páginas
-- de detalle para recargar datos frescos). Los cambios de estado del Kanban
-- (cambiarEstado) NO llevan este chequeo a propósito, para no complicar el
-- drag & drop.

alter table leads add column version integer not null default 1;
alter table clientes add column version integer not null default 1;
alter table tickets add column version integer not null default 1;

create or replace function fn_incrementar_version()
returns trigger
language plpgsql
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger trg_leads_version before update on leads
  for each row execute function fn_incrementar_version();

create trigger trg_clientes_version before update on clientes
  for each row execute function fn_incrementar_version();

create trigger trg_tickets_version before update on tickets
  for each row execute function fn_incrementar_version();
