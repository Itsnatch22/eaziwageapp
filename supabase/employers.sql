create table public.employers (
  id uuid not null default gen_random_uuid (),
  company_name text not null,
  company_code text not null,
  email public.citext not null,
  phone text null,
  status public.employer_status not null default 'pending'::employer_status,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  user_id uuid not null,
  employer_code text null,
  industry text null,
  country text null,
  registration_number text null,
  tax_id text null,
  address text null,
  contact_person text null,
  contact_email text null,
  contact_phone text null,
  payroll_cycle text null,
  risk_score numeric(3, 1) null,
  is_verified boolean null default false,
  employer_id uuid not null,
  metadata text null,
  risk_rating text null,
  constraint employers_pkey primary key (id),
  constraint employers_email_unique unique (email),
  constraint employers_company_code_unique unique (company_code),
  constraint employers_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint employers_email_check check ((email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::citext)),
  constraint employers_company_name_check check (
    (
      (char_length(company_name) >= 2)
      and (char_length(company_name) <= 120)
    )
  ),
  constraint employers_company_code_check check ((company_code ~ '^[A-Z0-9]{3,20}$'::text))
) TABLESPACE pg_default;

create unique INDEX IF not exists employers_user_id_key on public.employers using btree (user_id) TABLESPACE pg_default;

create unique INDEX IF not exists employers_employer_code_key on public.employers using btree (employer_code) TABLESPACE pg_default;

create index IF not exists idx_employers_status on public.employers using btree (status) TABLESPACE pg_default;

create index IF not exists idx_employers_company_code on public.employers using btree (company_code) TABLESPACE pg_default;

create trigger trg_employers_updated_at BEFORE
update on employers for EACH row
execute FUNCTION update_updated_at ();

create trigger trg_generate_employer_code BEFORE INSERT on employers for EACH row
execute FUNCTION generate_employer_code ();

create trigger set_employers_updated_at BEFORE
update on employers for EACH row
execute FUNCTION set_updated_at ();