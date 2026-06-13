-- Table to store browser push subscription objects per user
-- subscription_payload should store the JSON subscription object returned by the browser

create table public.system_push_subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  subscription_payload jsonb not null,
  endpoint text generated always as (subscription_payload ->> 'endpoint') stored,
  p256dh text generated always as (subscription_payload ->> 'keys' ->> 'p256dh') stored,
  auth_key text generated always as (subscription_payload ->> 'keys' ->> 'auth') stored,
  created_at timestamp with time zone not null default now(),
  last_sent_at timestamp with time zone null,
  active boolean not null default true,
  constraint system_push_subscriptions_pkey primary key (id),
  constraint system_push_subscriptions_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint system_push_subscriptions_user_endpoint_key unique (user_id, endpoint)
) TABLESPACE pg_default;

create index if not exists idx_system_push_subscriptions_user_id on public.system_push_subscriptions using btree (user_id) TABLESPACE pg_default;
create index if not exists idx_system_push_subscriptions_active on public.system_push_subscriptions using btree (active) TABLESPACE pg_default;
create index if not exists idx_system_push_subscriptions_created_at on public.system_push_subscriptions using btree (created_at desc) TABLESPACE pg_default;
