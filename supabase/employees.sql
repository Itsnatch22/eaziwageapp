create table public.employees (
  id uuid not null default extensions.uuid_generate_v4 (),
  organization_id uuid null,
  email text not null,
  name text not null,
  employee_number text null,
  department text null,
  status text null default 'Active'::text,
  hire_date date not null,
  termination_date date null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  user_id uuid not null,
  employer_id uuid not null,
  employee_code text null,
  full_name text not null,
  job_title text not null default 'Unassigned'::text,
  monthly_salary numeric(10, 2) not null default 0,
  kyc_status text not null default 'pending'::text,
  employment_type text not null default 'full-time'::text,
  advance_limit numeric(10, 2) not null default 0,
  earned_wages numeric(10, 2) not null default 0,
  risk_score numeric(3, 1) not null default 3.0,
  risk_override_reason text null,
  id_document_front boolean not null default false,
  id_document_back boolean not null default false,
  selfie boolean not null default false,
  address_proof boolean not null default false,
  payslip_1 boolean not null default false,
  payslip_2 boolean not null default false,
  bank_statement boolean not null default false,
  employment_contract boolean not null default false,
  phone text not null default 'N/A'::text,
  country text null,
  constraint employees_pkey primary key (id),
  constraint employees_organization_id_email_key unique (organization_id, email),
  constraint employees_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint employees_employer_id_fkey foreign KEY (employer_id) references employers (id) on delete CASCADE,
  constraint employees_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint check_employee_relationship check (
    (
      (employer_id is not null)
      or (organization_id is not null)
    )
  ),
  constraint employees_employment_type_check check (
    (
      employment_type = any (
        array[
          'full-time'::text,
          'part-time'::text,
          'contract'::text
        ]
      )
    )
  ),
  constraint employees_risk_score_check check (
    (
      (risk_score >= (0)::numeric)
      and (risk_score <= (5)::numeric)
    )
  ),
  constraint employees_status_check check (
    (
      status = any (
        array[
          'Active'::text,
          'Inactive'::text,
          'Terminated'::text
        ]
      )
    )
  ),
  constraint employees_kyc_status_check check (
    (
      kyc_status = any (
        array[
          'pending'::text,
          'submitted'::text,
          'approved'::text,
          'rejected'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists employees_email_idx on public.employees using btree (email) TABLESPACE pg_default;

create unique INDEX IF not exists employees_employee_code_key on public.employees using btree (employee_code) TABLESPACE pg_default;

create index IF not exists employees_organization_id_idx on public.employees using btree (organization_id) TABLESPACE pg_default;

create index IF not exists employees_status_idx on public.employees using btree (status) TABLESPACE pg_default;

create unique INDEX IF not exists employees_user_id_key on public.employees using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_employees_employer_id on public.employees using btree (employer_id) TABLESPACE pg_default;

create index IF not exists idx_employees_kyc_status on public.employees using btree (kyc_status) TABLESPACE pg_default;

create index IF not exists idx_employees_risk_score on public.employees using btree (risk_score) TABLESPACE pg_default
where
  (risk_score is not null);

create index IF not exists idx_employees_status on public.employees using btree (status) TABLESPACE pg_default;

create index IF not exists idx_employees_user_id on public.employees using btree (user_id) TABLESPACE pg_default;

create trigger t2 BEFORE
update on employees for EACH row
execute FUNCTION set_updated_at ();

create trigger trg_employees_updated_at BEFORE
update on employees for EACH row
execute FUNCTION update_updated_at ();

create trigger trg_generate_employee_code BEFORE INSERT on employees for EACH row
execute FUNCTION generate_employee_code ();