create table public.employers (
  id uuid not null default gen_random_uuid (),
  company_name text not null,
  company_code text not null,
  email public.citext not null,
  phone text null,
  status public.employer_status not null default 'pending'::employer_status,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  user_id uuid not null,
  employer_code text null,
  industry text null,
  country text not null,
  registration_number text null,
  tax_id text null,
  address text null,
  contact_person text null,
  contact_email text null,
  contact_phone text null,
  payroll_cycle text null,
  risk_score numeric(3, 1) not null default 3.0,
  is_verified boolean null default false,
  employer_id uuid not null,
  metadata text null,
  risk_rating text not null default 'B'::text,
  organization_id uuid null,
  onboarding_id uuid null,
  advance_limit_percent integer not null default 50,
  cooldown_days integer not null default 7,
  min_advance_amount numeric not null default 500,
  processing_fee numeric not null default 4.5,
  funding_model text not null default 'prefunded'::text,
  risk_tier text not null default 'low'::text,
  credit_limit numeric not null default 5000000,
  funding_buffer_percent integer not null default 20,
  max_monthly_advances integer not null default 10,
  employee_advance_limit_min integer not null default 10,
  employee_advance_limit_max integer not null default 60,
  employee_cooldown_min integer not null default 1,
  employee_cooldown_max integer not null default 14,
  ewa_enabled boolean not null default true,
  instant_enabled boolean not null default true,
  auto_approve boolean not null default true,
  weekend_access boolean not null default false,
  constraint employers_pkey primary key (id),
  constraint employers_email_unique unique (email),
  constraint employers_company_code_unique unique (company_code),
  constraint employers_onboarding_id_fkey foreign KEY (onboarding_id) references employer_onboarding (id) on delete set null,
  constraint employers_organization_id_fkey foreign KEY (organization_id) references organizations (id),
  constraint employers_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint employers_min_advance_amount_check check ((min_advance_amount >= (0)::numeric)),
  constraint employers_risk_tier_check check (
    (
      risk_tier = any (array['low'::text, 'medium'::text, 'high'::text])
    )
  ),
  constraint employers_funding_model_check check (
    (
      funding_model = any (
        array[
          'prefunded'::text,
          'debit_order'::text,
          'invoice'::text
        ]
      )
    )
  ),
  constraint employers_company_code_check check ((company_code ~ '^[A-Z0-9]{3,20}$'::text)),
  constraint employers_company_name_check check (
    (
      (char_length(company_name) >= 2)
      and (char_length(company_name) <= 120)
    )
  ),
  constraint employers_cooldown_days_check check ((cooldown_days >= 0)),
  constraint employers_email_check check ((email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::citext)),
  constraint employers_advance_limit_percent_check check (
    (
      (advance_limit_percent >= 0)
      and (advance_limit_percent <= 100)
    )
  )
) TABLESPACE pg_default;

create unique INDEX IF not exists employers_employer_code_key on public.employers using btree (employer_code) TABLESPACE pg_default;

create unique INDEX IF not exists employers_user_id_key on public.employers using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_employers_company_code on public.employers using btree (company_code) TABLESPACE pg_default;

create index IF not exists idx_employers_status on public.employers using btree (status) TABLESPACE pg_default;

create index IF not exists idx_employers_onboarding_id on public.employers using btree (onboarding_id) TABLESPACE pg_default;

create index IF not exists idx_employers_advance_limit on public.employers using btree (advance_limit_percent) TABLESPACE pg_default;

create trigger set_employers_updated_at BEFORE
update on employers for EACH row
execute FUNCTION set_updated_at ();

create trigger trg_generate_employer_code BEFORE INSERT on employers for EACH row
execute FUNCTION generate_employer_code ();