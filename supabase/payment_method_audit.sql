create table public.payment_method_audit (
  id uuid not null default gen_random_uuid (),
  payment_method_id uuid null,
  employee_id uuid null,
  action text not null,
  old_data jsonb null,
  new_data jsonb null,
  created_at timestamp with time zone not null default now(),
  constraint payment_method_audit_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_payment_method_audit_payment_method on public.payment_method_audit using btree (payment_method_id) TABLESPACE pg_default;

create index IF not exists idx_payment_method_audit_employee on public.payment_method_audit using btree (employee_id) TABLESPACE pg_default;