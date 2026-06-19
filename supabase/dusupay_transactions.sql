create table public.dusupay_transactions (
  id uuid not null default gen_random_uuid (),
  merchant_reference text not null,
  internal_reference text null,
  event_type text not null,
  status text not null,
  amount numeric(12, 2) null,
  currency text null,
  raw_payload jsonb not null,
  created_at timestamp with time zone null default now(),
  constraint dusupay_transactions_pkey primary key (id),
  constraint dusupay_transactions_merchant_reference_key unique (merchant_reference)
) TABLESPACE pg_default;

create index IF not exists idx_dusupay_transactions_status on public.dusupay_transactions using btree (status) TABLESPACE pg_default;

create index IF not exists idx_dusupay_transactions_created_at on public.dusupay_transactions using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_dusupay_transactions_internal_reference on public.dusupay_transactions using btree (internal_reference) TABLESPACE pg_default;