create table public.system_admins (
  id uuid not null,
  email text not null,
  full_name text null,
  avatar_url text null,
  created_at timestamp with time zone null default now(),
  is_admin boolean not null default true,
  failed_login_attempts integer not null default 0,
  locked_until timestamp with time zone null,
  constraint system_admins_pkey primary key (id),
  constraint system_admins_email_key unique (email),
  constraint system_admins_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_system_admins_email on public.system_admins using btree (email) TABLESPACE pg_default;

create index IF not exists idx_system_admins_is_admin on public.system_admins using btree (is_admin) TABLESPACE pg_default
where
  (is_admin = true);