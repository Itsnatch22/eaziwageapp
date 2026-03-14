create table public.employee_onboarding (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  employer_id uuid not null,
  status text not null default 'pending'::text,
  terms_accepted_at timestamp with time zone null,
  employee_code text null,
  national_id text not null,
  id_type text not null default 'national_id'::text,
  nationality text null,
  date_of_birth date not null,
  country text not null,
  address_line1 text not null,
  address_line2 text null,
  city text not null,
  postal_code text null,
  tax_id text null,
  job_title text not null,
  department text null,
  employment_type text not null,
  start_date date null,
  monthly_salary numeric(15, 2) not null,
  bank_name text not null,
  bank_account text not null,
  mobile_money_provider text not null,
  mobile_money_number text not null,
  id_front text null,
  id_back text null,
  address_proof text null,
  tax_certificate text null,
  payslip_1 text null,
  payslip_2 text null,
  bank_statement text null,
  employment_contract text null,
  submitted_at timestamp with time zone null,
  reviewed_at timestamp with time zone null,
  reviewed_by uuid null,
  review_notes text null,
  rejection_reason text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  face_id text null,
  full_name text null,
  email text null,
  risk_score text null,
  risk_level text null,
  constraint employee_onboarding_pkey primary key (id),
  constraint employee_onboarding_user_unique unique (user_id),
  constraint employee_onboarding_reviewed_by_fkey foreign KEY (reviewed_by) references auth.users (id),
  constraint employee_onboarding_employer_id_fkey foreign KEY (employer_id) references employer_onboarding (id),
  constraint employee_onboarding_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint employee_onboarding_id_type_check check (
    (
      id_type = any (array['national_id'::text, 'passport'::text])
    )
  ),
  constraint employee_onboarding_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'under_review'::text,
          'approved'::text,
          'rejected'::text,
          'suspended'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists employee_onboarding_employer_id_idx on public.employee_onboarding using btree (employer_id) TABLESPACE pg_default;

create index IF not exists employee_onboarding_user_id_idx on public.employee_onboarding using btree (user_id) TABLESPACE pg_default;

create index IF not exists employee_onboarding_status_idx on public.employee_onboarding using btree (status) TABLESPACE pg_default;

create index IF not exists employee_onboarding_employee_code_idx on public.employee_onboarding using btree (employee_code) TABLESPACE pg_default;

create trigger update_employee_onboarding_updated_at BEFORE
update on employee_onboarding for EACH row
execute FUNCTION update_updated_at_column ();

create trigger employee_onboarding_updated_at BEFORE
update on employee_onboarding for EACH row
execute FUNCTION update_updated_at ();