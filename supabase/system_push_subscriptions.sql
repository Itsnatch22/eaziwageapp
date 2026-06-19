create table public.system_push_subscriptions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  subscription_payload jsonb not null,
  endpoint text GENERATED ALWAYS as ((subscription_payload ->> 'endpoint'::text)) STORED null,
  p256dh text GENERATED ALWAYS as (
    (
      (subscription_payload -> 'keys'::text) ->> 'p256dh'::text
    )
  ) STORED null,
  auth_key text GENERATED ALWAYS as (
    (
      (subscription_payload -> 'keys'::text) ->> 'auth'::text
    )
  ) STORED null,
  created_at timestamp with time zone not null default now(),
  last_sent_at timestamp with time zone null,
  active boolean not null default true,
  constraint system_push_subscriptions_pkey primary key (id),
  constraint system_push_subscriptions_user_endpoint_key unique (user_id, endpoint),
  constraint system_push_subscriptions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_system_push_subscriptions_user_id on public.system_push_subscriptions using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_system_push_subscriptions_active on public.system_push_subscriptions using btree (active) TABLESPACE pg_default;

create index IF not exists idx_system_push_subscriptions_created_at on public.system_push_subscriptions using btree (created_at desc) TABLESPACE pg_default;