create table public.payroll_sync_logs (
  id uuid not null default gen_random_uuid (),
  integration_id uuid not null,
  employer_id uuid not null,
  triggered_by text not null default 'schedule'::text,
  status text not null,
  records_received integer null default 0,
  records_valid integer null default 0,
  records_failed integer null default 0,
  upload_id uuid null,
  error_message text null,
  duration_ms integer null,
  created_at timestamp with time zone not null default now(),
  constraint payroll_sync_logs_pkey primary key (id),
  constraint payroll_sync_logs_employer_id_fkey foreign KEY (employer_id) references employer_onboarding (id) on delete CASCADE,
  constraint payroll_sync_logs_integration_id_fkey foreign KEY (integration_id) references payroll_integrations (id) on delete CASCADE,
  constraint payroll_sync_logs_upload_id_fkey foreign KEY (upload_id) references payroll_uploads (id),
  constraint payroll_sync_logs_status_check check (
    (
      status = any (
        array['success'::text, 'failed'::text, 'partial'::text]
      )
    )
  ),
  constraint payroll_sync_logs_triggered_by_check check (
    (
      triggered_by = any (
        array['schedule'::text, 'manual'::text, 'webhook'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_sync_logs_employer on public.payroll_sync_logs using btree (employer_id, created_at desc) TABLESPACE pg_default;

create index IF not exists idx_sync_logs_integration on public.payroll_sync_logs using btree (integration_id, created_at desc) TABLESPACE pg_default;