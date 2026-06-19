create table public.help_searches (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  query text null,
  created_at timestamp with time zone null default now(),
  constraint help_searches_pkey primary key (id),
  constraint help_searches_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;