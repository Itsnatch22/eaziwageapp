create table public.payroll_uploads (
  id uuid not null default gen_random_uuid (),
  employer_id uuid not null,
  month text not null,
  source text not null default 'manual'::text,
  file_name text null,
  file_size_bytes integer null,
  storage_path text null,
  status text not null default 'pending'::text,
  total_rows integer null default 0,
  processed_rows integer null default 0,
  failed_rows integer null default 0,
  error_summary jsonb null default '[]'::jsonb,
  warning_summary jsonb null default '[]'::jsonb,
  total_gross numeric(15, 2) null default 0,
  total_net numeric(15, 2) null default 0,
  total_deductions numeric(15, 2) null default 0,
  integration_id uuid null,
  uploaded_by uuid null,
  uploaded_at timestamp with time zone not null default now(),
  processed_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  employer_live_id uuid null,
  constraint payroll_uploads_pkey primary key (id),
  constraint uq_upload_employer_month_source unique (employer_id, month, source),
  constraint payroll_uploads_integration_id_fkey foreign KEY (integration_id) references payroll_integrations (id),
  constraint payroll_uploads_employer_id_fkey foreign KEY (employer_id) references employer_onboarding (id) on delete CASCADE,
  constraint payroll_uploads_employer_live_id_fkey foreign KEY (employer_live_id) references employers (id),
  constraint payroll_uploads_uploaded_by_fkey foreign KEY (uploaded_by) references auth.users (id),
  constraint payroll_uploads_source_check check (
    (
      source = any (
        array[
          'manual'::text,
          'api_push'::text,
          'api_pull'::text,
          'sync'::text
        ]
      )
    )
  ),
  constraint payroll_uploads_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'processing'::text,
          'processed'::text,
          'failed'::text,
          'partial'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_payroll_uploads_employer_month on public.payroll_uploads using btree (employer_id, month desc) TABLESPACE pg_default;

create trigger trg_close_advances_on_payroll_processed
after
update on payroll_uploads for EACH row
execute FUNCTION fn_close_advances_on_payroll_processed ();

create trigger trg_guard_deleted_employer_onboarding BEFORE INSERT on payroll_uploads for EACH row
execute FUNCTION guard_employer_onboarding_not_deleted ();

create trigger trg_payroll_uploads_updated_at BEFORE
update on payroll_uploads for EACH row
execute FUNCTION update_updated_at ();