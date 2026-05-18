create table public.companiesdata (
  id uuid not null default gen_random_uuid (),
  name text not null,
  registration_number text null,
  country text not null,
  currency text null default 'KES'::text,
  logo_url text null,
  withdrawal_limit_percent integer null default 50,
  auto_approve_under_percent integer null default 25,
  auto_approve_enabled boolean null default false,
  created_at timestamp with time zone null default now(),
  constraint companiesdata_pkey primary key (id)
) TABLESPACE pg_default;