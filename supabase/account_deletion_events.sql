create table public.account_deletion_events (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  user_email text not null,
  user_full_name text not null,
  user_role public.user_role not null,
  deletion_reason text not null,
  deletion_reason_category text not null,
  additional_feedback text null,
  ip_address inet null,
  user_agent text null,
  created_at timestamp with time zone not null default now(),
  constraint account_deletion_events_pkey primary key (id),
  constraint account_deletion_events_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_account_deletion_events_user_id on public.account_deletion_events using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_account_deletion_events_created_at on public.account_deletion_events using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_account_deletion_events_reason_category on public.account_deletion_events using btree (deletion_reason_category) TABLESPACE pg_default;