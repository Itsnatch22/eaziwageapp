create table public.payment_methods (
  id uuid not null default gen_random_uuid (),
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
  constraint payment_methods_pkey primary key (id),
  constraint payment_methods_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_payment_methods_employee_id on public.payment_methods using btree (employee_id) TABLESPACE pg_default;

create index IF not exists idx_payment_methods_phone on public.payment_methods using btree (phone_number) TABLESPACE pg_default;

create unique INDEX IF not exists uq_payment_methods_employee_default on public.payment_methods using btree (employee_id) TABLESPACE pg_default
where
  (is_default = true);

create trigger set_payment_method_updated_at BEFORE
update on payment_methods for EACH row
execute FUNCTION set_payment_method_updated_at ();

create trigger audit_payment_method_changes
after INSERT
or DELETE
or
update on payment_methods for EACH row
execute FUNCTION audit_payment_method_changes ();