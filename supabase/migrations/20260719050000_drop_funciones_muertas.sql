-- supabase/migrations/20260719050000_drop_funciones_muertas.sql

drop function if exists public.mover_lead_estado(uuid, text);
drop function if exists public.mover_ticket_estado(uuid, text);
