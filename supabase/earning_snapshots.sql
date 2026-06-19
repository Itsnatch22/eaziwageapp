create table public.earnings_snapshots (
  id uuid not null default extensions.uuid_generate_v4 (),
  employee_id uuid not null,
  organization_id uuid not null,
  is_current boolean not null default true,
  current_salary numeric(12, 2) not null,
  currency character(3) not null,
  pay_period_start date not null,
  pay_period_end date not null,
  payday_date date not null,
  working_days integer not null,
  daily_rate numeric(12, 2) not null,
  earned_to_date numeric(12, 2) not null default 0,
  withdrawable_amount numeric(12, 2) not null default 0,
  withdrawn_this_month numeric(12, 2) not null default 0,
  remaining_withdrawable numeric GENERATED ALWAYS as (
    GREATEST(
      (0)::numeric,
      (withdrawable_amount - withdrawn_this_month)
    )
  ) STORED (12, 2) null,
  days_elapsed integer not null default 0,
  earnings_percentage numeric(5, 2) null default 0,
  withdrawable_percentage numeric(5, 2) null default 0,
  computed_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint earnings_snapshots_pkey primary key (id),
  constraint earnings_snapshots_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete CASCADE,
  constraint earnings_snapshots_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists earnings_snapshots_employee_id_idx on public.earnings_snapshots using btree (employee_id) TABLESPACE pg_default
where
  (is_current = true);

create trigger t3 BEFORE
update on earnings_snapshots for EACH row
execute FUNCTION set_updated_at ();