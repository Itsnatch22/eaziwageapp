create table public.employer_onboarding (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  status text not null default 'draft'::text,
  current_step integer not null default 0,
  terms_accepted_at timestamp with time zone null,
  company_name text null,
  registration_number text null,
  date_of_incorporation date null,
  country text null,
  physical_address text null,
  city text null,
  postal_code text null,
  county_region text null,
  tax_id text null,
  vat_number text null,
  industry text null,
  sector text null,
  business_description text null,
  years_in_operation integer null,
  employee_count integer null,
  countries_of_operation text[] null default '{}'::text[],
  annual_revenue_range text null,
  payroll_cycle text null,
  monthly_payroll_amount numeric(15, 2) null,
  bank_name text null,
  bank_account_number text null,
  contact_person text null,
  contact_email text null,
  contact_position text null,
  contact_phone text null,
  certificate_of_incorporation text null,
  business_registration text null,
  tax_compliance_certificate text null,
  cr12_document text null,
  kra_pin_certificate text null,
  business_permit text null,
  audited_financials text null,
  bank_statement text null,
  proof_of_address text null,
  proof_of_bank_account text null,
  employment_contract_template text null,
  submitted_at timestamp with time zone null,
  reviewed_at timestamp with time zone null,
  reviewed_by uuid null,
  review_notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  risk_score numeric(4, 2) null default 3.0,
  risk_rating text null default 'B'::text,
  country_code text null,
  company_code text null,
  email_notifications boolean null default true,
  advance_alerts boolean null default true,
  payroll_reminders boolean null default true,
  weekly_reports boolean null default false,
  max_advance_percentage integer null default 50,
  min_advance_amount numeric(15, 2) null default 500,
  advance_access_days integer[] null default array[1, 25],
  cooldown_period integer null default 7,
  settings jsonb null default '{}'::jsonb,
  deleted_at timestamp with time zone null,
  currency text not null,
  constraint employer_onboarding_pkey primary key (id),
  constraint employer_onboarding_company_code_key unique (company_code),
  constraint employer_onboarding_reviewed_by_fkey foreign KEY (reviewed_by) references auth.users (id),
  constraint employer_onboarding_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint employer_onboarding_max_advance_percentage_check check (
    (
      (max_advance_percentage >= 0)
      and (max_advance_percentage <= 100)
    )
  ),
  constraint employer_onboarding_min_advance_amount_check check ((min_advance_amount >= (0)::numeric)),
  constraint employer_onboarding_cooldown_period_check check ((cooldown_period >= 0)),
  constraint employer_onboarding_status_check check (
    (
      status = any (
        array[
          'draft'::text,
          'pending'::text,
          'submitted'::text,
          'under_review'::text,
          'risk_review_in_progress'::text,
          'approved'::text,
          'rejected'::text,
          'suspended'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists employer_onboarding_status_idx on public.employer_onboarding using btree (status) TABLESPACE pg_default;

create index IF not exists employer_onboarding_user_id_idx on public.employer_onboarding using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_employee_onboarding_full_name on public.employer_onboarding using gin (settings) TABLESPACE pg_default;

create index IF not exists idx_employer_onboarding_email_notifications on public.employer_onboarding using btree (email_notifications) TABLESPACE pg_default
where
  (email_notifications = true);

create index IF not exists idx_employer_onboarding_settings on public.employer_onboarding using gin (settings) TABLESPACE pg_default;

create trigger employer_onboarding_updated_at BEFORE
update on employer_onboarding for EACH row
execute FUNCTION update_updated_at ();

create trigger update_employer_onboarding_updated_at BEFORE
update on employer_onboarding for EACH row
execute FUNCTION update_updated_at_column ();