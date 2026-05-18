create table public.bank_change_requests (
  id uuid not null default gen_random_uuid (),
  employer_id uuid not null,
  user_id uuid not null,
  old_bank_name text null,
  old_account_number text null,
  new_bank_name text not null,
  new_account_number text not null,
  reason text null,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  reviewed_at timestamp with time zone null,
  reviewed_by uuid null,
  constraint bank_change_requests_pkey primary key (id),
  constraint bank_change_requests_employer_id_fkey foreign KEY (employer_id) references employer_onboarding (id) on delete CASCADE,
  constraint bank_change_requests_reviewed_by_fkey foreign KEY (reviewed_by) references auth.users (id),
  constraint bank_change_requests_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint bank_change_requests_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'approved'::text,
          'rejected'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_bank_change_requests_created on public.bank_change_requests using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_bank_change_requests_employer on public.bank_change_requests using btree (employer_id) TABLESPACE pg_default;

create index IF not exists idx_bank_change_requests_status on public.bank_change_requests using btree (status) TABLESPACE pg_default;