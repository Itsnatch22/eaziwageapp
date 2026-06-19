create table public.employee_ewa_settings (
  id uuid not null default gen_random_uuid (),
  employee_onboarding_id uuid not null,
  employer_id uuid not null,
  ewa_enabled boolean not null default true,
  max_advance_percentage integer not null default 50,
  min_advance_amount numeric(15, 2) not null default 500,
  max_advance_amount numeric(15, 2) not null default 50000,
  cooldown_period integer not null default 7,
  updated_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  employee_id uuid null,
  employer_live_id uuid null,
  constraint employee_ewa_settings_pkey primary key (id),
  constraint employee_ewa_settings_employee_id_key unique (employee_id),
  constraint ewa_settings_employee_unique unique (employee_onboarding_id),
  constraint employee_ewa_settings_employer_id_fkey foreign KEY (employer_id) references employer_onboarding (id) on delete CASCADE,
  constraint employee_ewa_settings_employer_live_id_fkey foreign KEY (employer_live_id) references employers (id) on delete set null,
  constraint employee_ewa_settings_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete set null,
  constraint employee_ewa_settings_employee_onboarding_id_fkey foreign KEY (employee_onboarding_id) references employee_onboarding (id) on delete CASCADE,
  constraint employee_ewa_settings_updated_by_fkey foreign KEY (updated_by) references auth.users (id),
  constraint employee_ewa_settings_cooldown_period_check check (
    (
      (cooldown_period >= 0)
      and (cooldown_period <= 30)
    )
  ),
  constraint employee_ewa_settings_max_advance_percentage_check check (
    (
      (max_advance_percentage >= 10)
      and (max_advance_percentage <= 100)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_employee_ewa_settings_employee_id on public.employee_ewa_settings using btree (employee_id) TABLESPACE pg_default;

create index IF not exists idx_employee_ewa_settings_employer_live_id on public.employee_ewa_settings using btree (employer_live_id) TABLESPACE pg_default;

create trigger employee_ewa_settings_updated_at BEFORE
update on employee_ewa_settings for EACH row
execute FUNCTION update_updated_at ();