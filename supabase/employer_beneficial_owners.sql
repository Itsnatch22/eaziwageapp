create table public.employer_beneficial_owners (
  id uuid not null default gen_random_uuid (),
  onboarding_id uuid not null,
  full_name text not null,
  id_number text not null,
  nationality text null,
  ownership_percentage numeric(5, 2) null,
  is_pep boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint employer_beneficial_owners_pkey primary key (id),
  constraint employer_beneficial_owners_onboarding_id_fkey foreign KEY (onboarding_id) references employer_onboarding (id) on delete CASCADE,
  constraint employer_beneficial_owners_ownership_percentage_check check (
    (
      (ownership_percentage >= (0)::numeric)
      and (ownership_percentage <= (100)::numeric)
    )
  )
) TABLESPACE pg_default;