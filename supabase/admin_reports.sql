create table public.admin_reports (
  id uuid not null default gen_random_uuid (),
  name text not null,
  description text not null,
  type text not null,
  period text not null,
  status text not null default 'generating'::text,
  generated_at timestamp with time zone null,
  file_size text null,
  download_url text null,
  scheduled_for timestamp with time zone null,
  metrics jsonb null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint admin_reports_pkey primary key (id),
  constraint admin_reports_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint admin_reports_period_check check (
    (
      period = any (
        array[
          'today'::text,
          'day'::text,
          'week'::text,
          'month'::text,
          'quarter'::text,
          'year'::text,
          'custom'::text
        ]
      )
    )
  ),
  constraint admin_reports_status_check check (
    (
      status = any (
        array[
          'generating'::text,
          'ready'::text,
          'failed'::text,
          'scheduled'::text
        ]
      )
    )
  ),
  constraint admin_reports_type_check check (
    (
      type = any (
        array[
          'financial'::text,
          'operational'::text,
          'compliance'::text,
          'performance'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists admin_reports_created_at_idx on public.admin_reports using btree (created_at) TABLESPACE pg_default;

create index IF not exists admin_reports_created_by_idx on public.admin_reports using btree (created_by) TABLESPACE pg_default;

create index IF not exists admin_reports_generated_at_idx on public.admin_reports using btree (generated_at) TABLESPACE pg_default;

create index IF not exists admin_reports_period_idx on public.admin_reports using btree (period) TABLESPACE pg_default;

create index IF not exists admin_reports_status_idx on public.admin_reports using btree (status) TABLESPACE pg_default;

create index IF not exists admin_reports_status_type_idx on public.admin_reports using btree (status, type) TABLESPACE pg_default;

create index IF not exists admin_reports_type_idx on public.admin_reports using btree (type) TABLESPACE pg_default;

create trigger update_admin_reports_updated_at_trigger BEFORE
update on admin_reports for EACH row
execute FUNCTION update_admin_reports_updated_at ();