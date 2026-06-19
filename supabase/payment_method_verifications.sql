create table public.payment_method_verifications (
  id uuid not null default gen_random_uuid (),
  payment_method_id uuid not null,
  otp text not null,
  attempts integer not null default 0,
  is_used boolean not null default false,
  expires_at timestamp with time zone not null,
  used_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint payment_method_verifications_pkey primary key (id),
  constraint payment_method_verifications_payment_method_id_fkey foreign KEY (payment_method_id) references payment_methods (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_payment_method_verifications_payment_method on public.payment_method_verifications using btree (payment_method_id) TABLESPACE pg_default;

create index IF not exists idx_payment_method_verifications_is_used on public.payment_method_verifications using btree (is_used) TABLESPACE pg_default;