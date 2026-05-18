create table public.companies (
  id uuid not null default gen_random_uuid (),
  name text not null,
  size integer null,
  created_at timestamp without time zone null default now(),
  constraint companies_pkey primary key (id)
) TABLESPACE pg_default;