-- Extensiones necesarias (Supabase normalmente ya trae pgcrypto activo,
-- se deja explícito por si se corre en un Postgres limpio)
create extension if not exists pgcrypto;
