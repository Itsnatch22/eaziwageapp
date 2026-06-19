create table public.payroll_upload_rows (
  id uuid not null default gen_random_uuid (),
  upload_id uuid not null,
  employer_id uuid not null,
  employee_code text not null,
  employee_id uuid null,
  days_worked numeric(4, 1) null,
  gross_salary numeric(15, 2) null,
  deductions numeric(15, 2) null default 0,
  net_salary numeric(15, 2) null,
  row_status text not null default 'pending'::text,
  row_errors jsonb null default '[]'::jsonb,
  row_warnings jsonb null default '[]'::jsonb,
  source_row integer null,
  created_at timestamp with time zone not null default now(),
  live_employee_id uuid null,
  constraint payroll_upload_rows_pkey primary key (id),
  constraint payroll_upload_rows_employee_id_fkey foreign KEY (employee_id) references employee_onboarding (id),
  constraint payroll_upload_rows_employer_id_fkey foreign KEY (employer_id) references employer_onboarding (id) on delete CASCADE,
  constraint payroll_upload_rows_live_employee_id_fkey foreign KEY (live_employee_id) references employees (id) on delete set null,
  constraint payroll_upload_rows_upload_id_fkey foreign KEY (upload_id) references payroll_uploads (id) on delete CASCADE,
  constraint payroll_upload_rows_row_status_check check (
    (
      row_status = any (
        array[
          'pending'::text,
          'valid'::text,
          'invalid'::text,
          'warning'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_upload_rows_employer_code on public.payroll_upload_rows using btree (employer_id, employee_code) TABLESPACE pg_default;

create index IF not exists idx_upload_rows_upload on public.payroll_upload_rows using btree (upload_id) TABLESPACE pg_default;

create index IF not exists idx_payroll_upload_rows_live_employee_id on public.payroll_upload_rows using btree (live_employee_id) TABLESPACE pg_default;