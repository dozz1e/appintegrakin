-- supabase/migrations/20260714210000_tickets_post_venta_seguimientos.sql
--
-- Bitácora de seguimiento de un ticket de post-venta — mismo patrón que
-- cliente_interacciones (solo insert + select, sin update/delete).

create table tickets_post_venta_seguimientos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets_post_venta(id) on delete cascade,
  fecha date not null default current_date,
  comentario text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_tpv_seguimientos_ticket on tickets_post_venta_seguimientos(ticket_id);

alter table tickets_post_venta_seguimientos enable row level security;

create policy select_tpv_seguimientos on tickets_post_venta_seguimientos
for select using (has_permission(auth.uid(), 'tickets_post_venta', 'view'));

create policy insert_tpv_seguimientos on tickets_post_venta_seguimientos
for insert with check (
  created_by = auth.uid()
  and has_permission(auth.uid(), 'tickets_post_venta', 'edit')
);
