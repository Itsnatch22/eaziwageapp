create table public.exchange_rates (
  currency_code text not null,
  rate_to_usd numeric(12, 6) not null,
  updated_at timestamp with time zone null default now(),
  constraint exchange_rates_pkey primary key (currency_code)
) TABLESPACE pg_default;