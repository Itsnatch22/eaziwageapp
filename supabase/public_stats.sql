create table public.public_stats (
  id integer not null default 1,
  total_users integer not null default 0,
  active_employers integer not null default 0,
  active_employees integer not null default 0,
  total_disbursed numeric(20, 2) not null default 0,
  updated_at timestamp with time zone not null default now(),
  constraint public_stats_pkey primary key (id),
  constraint public_stats_single_row check ((id = 1))
) TABLESPACE pg_default;

create index IF not exists idx_public_stats_updated_at on public.public_stats using btree (updated_at) TABLESPACE pg_default;