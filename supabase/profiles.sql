create table public.profiles (
  id uuid not null,
  full_name text not null,
  email public.citext not null,
  phone text not null,
  phone_country_code public.country_code not null,
  role public.user_role not null,
  company_code text null,
  company_name text null,
  email_verified boolean not null default false,
  onboarding_complete boolean not null default false,
  avatar_url text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  failed_login_attempts integer not null default 0,
  locked_until timestamp with time zone null,
  last_login_at timestamp with time zone null,
  is_admin boolean not null default false,
  is_active boolean null default true,
  role_normalized text null,
  payment_methods jsonb null default '[]'::jsonb,
  organization_id uuid null,
  constraint profiles_pkey primary key (id),
  constraint profiles_email_unique unique (email),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE,
  constraint profiles_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete set null,
  constraint profiles_company_code_fkey foreign KEY (company_code) references employers (company_code) on delete set null,
  constraint profiles_role_check check (
    (
      role = any (
        array[
          'employer'::user_role,
          'employee'::user_role,
          'admin'::user_role
        ]
      )
    )
  ),
  constraint profiles_company_name_check check ((char_length(company_name) <= 120)),
  constraint profiles_email_check check ((email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::citext)),
  constraint profiles_full_name_check check (
    (
      (char_length(full_name) >= 2)
      and (char_length(full_name) <= 100)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_profiles_company_code on public.profiles using btree (company_code) TABLESPACE pg_default
where
  (company_code is not null);

create index IF not exists idx_profiles_created_at on public.profiles using btree (created_at) TABLESPACE pg_default;

create index IF not exists idx_profiles_email on public.profiles using btree (email) TABLESPACE pg_default;

create index IF not exists idx_profiles_full_name on public.profiles using btree (full_name) TABLESPACE pg_default;

create index IF not exists idx_profiles_is_active on public.profiles using btree (is_active) TABLESPACE pg_default;

create index IF not exists idx_profiles_is_admin on public.profiles using btree (is_admin) TABLESPACE pg_default
where
  (is_admin = true);

create index IF not exists idx_profiles_locked_until on public.profiles using btree (locked_until) TABLESPACE pg_default
where
  (locked_until is not null);

create index IF not exists idx_profiles_payment_methods on public.profiles using gin (payment_methods) TABLESPACE pg_default;

create index IF not exists idx_profiles_role on public.profiles using btree (role) TABLESPACE pg_default;

create index IF not exists idx_profiles_role_normalized on public.profiles using btree (role_normalized) TABLESPACE pg_default;

create index IF not exists idx_profiles_organization_id on public.profiles using btree (organization_id) TABLESPACE pg_default;

create trigger set_profiles_updated_at BEFORE
update on profiles for EACH row
execute FUNCTION set_updated_at ();