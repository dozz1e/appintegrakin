-- RPC atómico: crea el cliente a partir del lead y linkea ambos registros.
-- security definer porque cruza dos tablas con RLS distintas; valida permisos a mano adentro.

create or replace function convertir_lead_a_cliente(
  p_lead_id uuid,
  p_rut text,
  p_razon_social text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_lead leads%rowtype;
  v_cliente_id uuid;
begin
  if not has_permission(auth.uid(), 'leads', 'edit') then
    raise exception 'Sin permiso para editar leads';
  end if;

  if not has_permission(auth.uid(), 'clientes', 'create') then
    raise exception 'Sin permiso para crear clientes';
  end if;

  select * into v_lead from leads where id = p_lead_id;
  if not found then
    raise exception 'Lead % no encontrado', p_lead_id;
  end if;

  if v_lead.cliente_id is not null then
    raise exception 'Este lead ya fue convertido';
  end if;

  if not has_permission(auth.uid(), 'leads', 'view_all') and v_lead.owner_id <> auth.uid() then
    raise exception 'Sin permiso sobre este lead';
  end if;

  insert into clientes (rut, razon_social, nombre_contacto, telefono, email, owner_id, created_by)
  values (p_rut, p_razon_social, v_lead.nombre, v_lead.telefono, v_lead.email, v_lead.owner_id, auth.uid())
  returning id into v_cliente_id;

  update leads
  set cliente_id = v_cliente_id, estado = 'ganado', updated_at = now()
  where id = p_lead_id;

  return v_cliente_id;
end;
$$;
