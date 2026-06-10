-- Configurable payout providers per country

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

-- seed common providers for KE, UG, TZ, RW
insert into public.payout_providers (country_code, provider_key, provider_name, method_type) values
  ('KE', 'mpesa', 'M-PESA', 'mobile_money') on conflict do nothing,
  ('KE', 'airtel', 'Airtel Money', 'mobile_money') on conflict do nothing,
  ('UG', 'mtn', 'MTN Mobile Money', 'mobile_money') on conflict do nothing,
  ('UG', 'airtel', 'Airtel Money', 'mobile_money') on conflict do nothing,
  ('TZ', 'mpesa', 'M-Pesa Tanzania', 'mobile_money') on conflict do nothing,
  ('TZ', 'airtel', 'Airtel Money', 'mobile_money') on conflict do nothing,
  ('TZ', 'tigo', 'Tigo Pesa', 'mobile_money') on conflict do nothing,
  ('RW', 'mtn', 'MTN MoMo', 'mobile_money') on conflict do nothing,
  ('RW', 'airtel', 'Airtel Money', 'mobile_money') on conflict do nothing;
