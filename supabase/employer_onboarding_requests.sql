create table public.employer_onboarding_requests (
  id uuid not null default extensions.uuid_generate_v4 (),
  employee_name character varying(255) not null,
  employee_email character varying(255) not null,
  employee_phone character varying(20) not null,
  company_name character varying(255) not null,
  employer_name character varying(255) not null,
  employer_email character varying(255) not null,
  employer_phone character varying(20) not null,
  status character varying(50) null default 'pending'::character varying,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  notes text null,
  constraint employer_onboarding_requests_pkey primary key (id),
  constraint employer_onboarding_requests_status_check check (
    (
      (status)::text = any (
        array[
          ('pending'::character varying)::text,
          ('approved'::character varying)::text,
          ('rejected'::character varying)::text,
          ('contacted'::character varying)::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_onboarding_requests_created_at on public.employer_onboarding_requests using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_onboarding_requests_employer_email on public.employer_onboarding_requests using btree (employer_email) TABLESPACE pg_default;

create index IF not exists idx_onboarding_requests_status on public.employer_onboarding_requests using btree (status) TABLESPACE pg_default;

create trigger update_employer_onboarding_requests_updated_at BEFORE
update on employer_onboarding_requests for EACH row
execute FUNCTION update_updated_at_column ();