-- Trazabilidad genérica: qué usuario cambió qué fila en clientes/leads/tickets.
-- Trigger reutilizable, se engancha a las tres tablas.

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tabla text not null,
  registro_id uuid not null,
  usuario_id uuid references profiles(id),
  accion text not null,        -- 'insert' | 'update' | 'delete'
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  created_at timestamptz default now()
);

create index idx_audit_log_registro on audit_log(tabla, registro_id);

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
    case when tg_op in ('update','delete') then to_jsonb(old) else null end,
    case when tg_op in ('update','insert') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_clientes after insert or update or delete on clientes
  for each row execute function registrar_auditoria();

create trigger audit_leads after insert or update or delete on leads
  for each row execute function registrar_auditoria();

create trigger audit_tickets after insert or update or delete on tickets
  for each row execute function registrar_auditoria();
