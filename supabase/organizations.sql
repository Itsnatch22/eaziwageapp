create table public.organizations (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  slug text not null,
  country_code character(2) not null default 'KE'::bpchar,
  currency character(3) not null default 'USD'::bpchar,
  withdrawable_percentage numeric(5, 2) not null default 50,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  country text null,
  liquidity_pool numeric null default 5000000,
  is_frozen boolean null default false,
  constraint organizations_pkey primary key (id),
  constraint organizations_slug_key unique (slug),
  constraint organizations_country_check check (
    (
      country = any (
        array['KE'::text, 'UG'::text, 'RW'::text, 'TZ'::text]
      )
    )
  ),
  constraint organizations_withdrawable_percentage_check check (
    (
      (withdrawable_percentage > (0)::numeric)
      and (withdrawable_percentage <= (100)::numeric)
    )
  )
) TABLESPACE pg_default;

create index IF not exists organizations_country_code_idx on public.organizations using btree (country_code) TABLESPACE pg_default;

create index IF not exists organizations_slug_idx on public.organizations using btree (slug) TABLESPACE pg_default;

create trigger t1 BEFORE
update on organizations for EACH row
execute FUNCTION set_updated_at ();