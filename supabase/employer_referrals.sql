create table public.employer_referrals (
  id uuid not null default gen_random_uuid (),
  referred_by_user_id uuid not null,
  employer_name text not null,
  employer_email public.citext not null,
  employer_phone text not null,
  status public.referral_status not null default 'pending'::referral_status,
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint employer_referrals_pkey primary key (id),
  constraint employer_referrals_referred_by_user_id_fkey foreign KEY (referred_by_user_id) references auth.users (id) on delete CASCADE,
  constraint employer_referrals_employer_email_check check (
    (
      employer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::citext
    )
  ),
  constraint employer_referrals_employer_name_check check (
    (
      (char_length(employer_name) >= 2)
      and (char_length(employer_name) <= 120)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_employer_referrals_referred_by on public.employer_referrals using btree (referred_by_user_id) TABLESPACE pg_default;

create index IF not exists idx_employer_referrals_status on public.employer_referrals using btree (status) TABLESPACE pg_default;

create trigger set_employer_referrals_updated_at BEFORE
update on employer_referrals for EACH row
execute FUNCTION set_updated_at ();