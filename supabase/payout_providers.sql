create table public.payout_providers (
  id serial not null,
  country_code text not null,
  provider_key text not null,
  provider_name text not null,
  method_type text not null,
  config jsonb null,
  enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint payout_providers_pkey primary key (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists uq_payout_providers_key_country on public.payout_providers using btree (country_code, provider_key) TABLESPACE pg_default;