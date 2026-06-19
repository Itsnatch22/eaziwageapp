create table public.dusupay_wallet_mirror (
  id uuid not null default gen_random_uuid (),
  currency text not null,
  balance numeric(15, 2) not null default 0,
  last_sync_at timestamp with time zone null default now(),
  constraint dusupay_wallet_mirror_pkey primary key (id),
  constraint dusupay_wallet_mirror_currency_key unique (currency)
) TABLESPACE pg_default;