-- supabase/migrations/20260715230000_ciudad_comuna_cliente.sql

alter table clientes add column ciudad text;
alter table clientes add column comuna text;
