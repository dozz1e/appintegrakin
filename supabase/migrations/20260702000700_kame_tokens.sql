-- Cache del token de Kame ERP (vigencia 24h). Solo el backend (server routes de
-- Nuxt) lee/escribe esta tabla; no se expone al cliente ni tiene policy de select
-- para usuarios normales.

create table kame_tokens (
  id int primary key default 1,
  token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz default now(),
  constraint solo_una_fila check (id = 1)
);

alter table kame_tokens enable row level security;
-- Sin policies = nadie con anon/authenticated key puede leer/escribir.
-- Solo el service role (usado en server/api/kame/*) puede acceder, porque
-- el service role bypassea RLS por diseño de Supabase.
