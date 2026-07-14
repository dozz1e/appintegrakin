-- avatar_url: foto de perfil del usuario (bucket perfiles-imagenes, ver
-- migración siguiente). settings: configuraciones personales del usuario
-- en jsonb libre, para no requerir una migración por cada configuración
-- nueva (empieza con la key "umbral_alertas_minutos", resuelta en código
-- con default 30 cuando no está presente — no se preseedea acá).
--
-- No hace falta política RLS nueva: profiles_update_own
-- (20260702000900_rls_profiles.sql:18-19) ya permite a cada usuario
-- actualizar su propia fila, y proteger_cambio_rol solo bloquea
-- role_id/active.

alter table profiles add column avatar_url text;
alter table profiles add column settings jsonb not null default '{}';
