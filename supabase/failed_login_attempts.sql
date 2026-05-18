create table public.failed_login_attempts (
  id uuid not null default gen_random_uuid (),
  email text not null,
  ip_address text not null,
  user_agent text null,
  reason text not null,
  attempted_at timestamp with time zone not null default now(),
  constraint failed_login_attempts_pkey primary key (id),
  constraint failed_login_attempts_reason_check check (
    (
      reason = any (
        array[
          'invalid_password'::text,
          'user_not_found'::text,
          'account_locked'::text,
          'email_not_verified'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_failed_login_attempted_at on public.failed_login_attempts using btree (attempted_at desc) TABLESPACE pg_default;

create index IF not exists idx_failed_login_email on public.failed_login_attempts using btree (email) TABLESPACE pg_default;

create index IF not exists idx_failed_login_email_time on public.failed_login_attempts using btree (email, attempted_at desc) TABLESPACE pg_default;

create index IF not exists idx_failed_logins_attempted_at on public.failed_login_attempts using btree (attempted_at desc) TABLESPACE pg_default;

create index IF not exists idx_failed_logins_email on public.failed_login_attempts using btree (email) TABLESPACE pg_default;

create index IF not exists idx_failed_logins_email_attempted on public.failed_login_attempts using btree (email, attempted_at desc) TABLESPACE pg_default;