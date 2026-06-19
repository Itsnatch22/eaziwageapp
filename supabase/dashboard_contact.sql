create table public.dashboard_contact (
  id uuid not null default gen_random_uuid (),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  ip_address text null,
  user_agent text null,
  is_read boolean null default false,
  status text null default 'pending'::text,
  submitted_at timestamp with time zone not null default timezone ('utc'::text, now()),
  metadata jsonb null default '{}'::jsonb,
  constraint dashboard_contact_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_dashboard_contact_email on public.dashboard_contact using btree (email) TABLESPACE pg_default;

create index IF not exists idx_dashboard_contact_submitted_at on public.dashboard_contact using btree (submitted_at desc) TABLESPACE pg_default;