create table public.payroll_integrations (
  id uuid not null default gen_random_uuid (),
  employer_id uuid not null,
  provider text not null,
  provider_label text null,
  integration_code text not null,
  webhook_secret text null,
  sync_mode text not null default 'manual'::text,
  sync_frequency text not null default 'daily'::text,
  sync_time text null default '06:00'::text,
  status text not null default 'pending'::text,
  last_sync_at timestamp with time zone null,
  last_sync_status text null,
  last_error text null,
  connected_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  webhook_secret_encrypted bytea null,
  constraint payroll_integrations_pkey primary key (id),
  constraint payroll_integrations_integration_code_key unique (integration_code),
  constraint uq_integration_employer_provider unique (employer_id, provider),
  constraint payroll_integrations_employer_id_fkey foreign KEY (employer_id) references employer_onboarding (id) on delete CASCADE,
  constraint payroll_integrations_connected_by_fkey foreign KEY (connected_by) references auth.users (id),
  constraint payroll_integrations_last_sync_status_check check (
    (
      last_sync_status = any (
        array['success'::text, 'failed'::text, 'partial'::text]
      )
    )
  ),
  constraint payroll_integrations_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'active'::text,
          'error'::text,
          'disconnected'::text
        ]
      )
    )
  ),
  constraint payroll_integrations_sync_frequency_check check (
    (
      sync_frequency = any (
        array[
          'realtime'::text,
          'hourly'::text,
          'daily'::text,
          'weekly'::text,
          'monthly'::text
        ]
      )
    )
  ),
  constraint payroll_integrations_sync_mode_check check (
    (
      sync_mode = any (array['auto'::text, 'manual'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_payroll_integrations_employer on public.payroll_integrations using btree (employer_id) TABLESPACE pg_default;

create trigger trg_payroll_integrations_updated_at BEFORE
update on payroll_integrations for EACH row
execute FUNCTION update_updated_at ();