create table public.sectors (
  id uuid not null default gen_random_uuid (),
  name text not null,
  industry text not null,
  created_at timestamp with time zone not null default now(),
  constraint sectors_pkey primary key (id)
) TABLESPACE pg_default;