create table public.login_events (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  ip_address text not null,
  user_agent text not null default ''::text,
  created_at timestamp with time zone not null default now(),
  constraint login_events_pkey primary key (id),
  constraint login_events_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_login_events_ip_address on public.login_events using btree (ip_address) TABLESPACE pg_default;

create index IF not exists idx_login_events_user_id_created on public.login_events using btree (user_id, created_at desc) TABLESPACE pg_default;