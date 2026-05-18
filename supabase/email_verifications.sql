create table public.email_verifications (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  token_hash text not null,
  used_at timestamp with time zone null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  constraint email_verifications_pkey primary key (id),
  constraint email_verifications_token_hash_unique unique (token_hash),
  constraint email_verifications_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_email_verifications_expires_at on public.email_verifications using btree (expires_at) TABLESPACE pg_default;

create index IF not exists idx_email_verifications_user_id on public.email_verifications using btree (user_id) TABLESPACE pg_default;