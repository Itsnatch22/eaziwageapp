create table public.policies (
  id uuid not null default gen_random_uuid (),
  employer_id uuid not null,
  withdrawal_limit_percent integer not null default 50,
  frequency_cap integer null,
  auto_approval_threshold numeric null default 500,
  auto_approval_enabled boolean null default true,
  min_advance_amount numeric null default 500,
  max_advance_amount numeric null default 50000,
  cooldown_days integer null default 0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint policies_pkey primary key (id),
  constraint policies_organization_id_key unique (employer_id),
  constraint policies_employer_id_fkey foreign KEY (employer_id) references employers (id) on delete CASCADE,
  constraint policies_withdrawal_limit_percent_check check (
    (
      (withdrawal_limit_percent >= 1)
      and (withdrawal_limit_percent <= 100)
    )
  )
) TABLESPACE pg_default;