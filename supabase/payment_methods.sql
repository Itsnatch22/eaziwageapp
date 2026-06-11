create table if not exists public.payment_methods (
  id uuid not null default gen_random_uuid(),
  employee_id uuid not null,
  country_code text not null,
  method_type text not null,
  provider_name text not null,
  account_name text null,
  account_number text null,
  phone_number text null,
  is_default boolean not null default false,
  is_verified boolean not null default false,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint payment_methods_pkey primary key (id)
) tablespace pg_default;

create index if not exists idx_payment_methods_employee_id on public.payment_methods using btree (employee_id) tablespace pg_default;
create index if not exists idx_payment_methods_phone on public.payment_methods using btree (phone_number) tablespace pg_default;

-- enforce single default per employee
create unique index if not exists uq_payment_methods_employee_default on public.payment_methods (employee_id) where (is_default = true) tablespace pg_default;

-- trigger to update updated_at
create or replace function set_payment_method_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_payment_method_updated_at before update on public.payment_methods
for each row execute function set_payment_method_updated_at();

-- Audit table for payment method changes
create table if not exists public.payment_method_audit (
  id uuid not null default gen_random_uuid(),
  payment_method_id uuid null,
  employee_id uuid null,
  action text not null,
  old_data jsonb null,
  new_data jsonb null,
  created_at timestamp with time zone not null default now(),
  constraint payment_method_audit_pkey primary key (id)
) tablespace pg_default;

create index if not exists idx_payment_method_audit_payment_method on public.payment_method_audit using btree (payment_method_id) tablespace pg_default;
create index if not exists idx_payment_method_audit_employee on public.payment_method_audit using btree (employee_id) tablespace pg_default;
