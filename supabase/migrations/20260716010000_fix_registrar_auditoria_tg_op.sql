-- Bug desde el origen de audit_log (20260702000800): TG_OP en Postgres
-- siempre viene en MAYÚSCULA ('INSERT'/'UPDATE'/'DELETE'), pero la función
-- comparaba contra literales en minúscula ('update','delete','insert') -
-- la comparación nunca matcheaba, así que datos_anteriores/datos_nuevos
-- quedaron NULL en el 100% de los 4400+ registros históricos de auditoría
-- (la columna `accion` sí se guardaba bien porque usa lower(tg_op) directo,
-- por eso el bug pasó desapercibido: la fila se veía "normal" en la lista,
-- solo el diff expandido salía vacío).
--
-- Los datos históricos ya perdidos no se pueden reconstruir (el snapshot
-- del antes/después nunca se guardó). Este fix solo aplica hacia adelante.

create or replace function registrar_auditoria()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into audit_log (tabla, registro_id, usuario_id, accion, datos_anteriores, datos_nuevos)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    auth.uid(),
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;
