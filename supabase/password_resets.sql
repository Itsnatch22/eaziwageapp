create table public.password_resets (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  token_hash text not null,
  expires_at timestamp with time zone not null default (now() + '01:00:00'::interval),
  used_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint password_resets_pkey primary key (id),
  constraint password_resets_token_hash_key unique (token_hash),
  constraint password_resets_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_password_resets_expires_at on public.password_resets using btree (expires_at) TABLESPACE pg_default;

create index IF not exists idx_password_resets_token_hash on public.password_resets using btree (token_hash) TABLESPACE pg_default;

create index IF not exists idx_password_resets_user_id on public.password_resets using btree (user_id) TABLESPACE pg_default;

create trigger trg_limit_active_password_resets BEFORE INSERT on password_resets for EACH row
execute FUNCTION limit_active_password_resets ();