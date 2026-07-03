
-- ============================================================
-- TABLE: payout_providers
-- ============================================================
create table if not exists public.payout_providers (
  id serial primary key,
  country_code text not null,
  provider_key text not null,
  provider_name text not null,
  method_type text not null,
  config jsonb null,
  enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists uq_payout_providers_key_country on public.payout_providers (country_code, provider_key);

-- ============================================================
-- TABLE: payment_methods (with FK to employees)
-- ============================================================
create table if not exists public.payment_methods (
  id uuid not null default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
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
);

create index if not exists idx_payment_methods_employee_id on public.payment_methods using btree (employee_id);
create index if not exists idx_payment_methods_phone on public.payment_methods using btree (phone_number);
create unique index if not exists uq_payment_methods_employee_default on public.payment_methods (employee_id) where (is_default = true);

-- updated_at trigger
create or replace function set_payment_method_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_payment_method_updated_at before update on public.payment_methods
for each row execute function set_payment_method_updated_at();

-- ============================================================
-- TABLE: payment_method_audit
-- ============================================================
create table if not exists public.payment_method_audit (
  id uuid not null default gen_random_uuid(),
  payment_method_id uuid null,
  employee_id uuid null,
  action text not null,
  old_data jsonb null,
  new_data jsonb null,
  created_at timestamp with time zone not null default now(),
  constraint payment_method_audit_pkey primary key (id)
);

create index if not exists idx_payment_method_audit_payment_method on public.payment_method_audit using btree (payment_method_id);
create index if not exists idx_payment_method_audit_employee on public.payment_method_audit using btree (employee_id);

-- audit trigger on payment_methods
create or replace function audit_payment_method_changes() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.payment_method_audit (payment_method_id, employee_id, action, new_data)
    values (new.id, new.employee_id, 'INSERT', to_jsonb(new));
  elsif (tg_op = 'UPDATE') then
    insert into public.payment_method_audit (payment_method_id, employee_id, action, old_data, new_data)
    values (new.id, new.employee_id, 'UPDATE', to_jsonb(old), to_jsonb(new));
  elsif (tg_op = 'DELETE') then
    insert into public.payment_method_audit (payment_method_id, employee_id, action, old_data)
    values (old.id, old.employee_id, 'DELETE', to_jsonb(old));
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger audit_payment_method_changes
after insert or update or delete on public.payment_methods
for each row execute function audit_payment_method_changes();

