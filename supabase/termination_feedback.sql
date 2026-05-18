create table public.termination_feedback (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  employer_id uuid null,
  reason text not null,
  other_reason text null,
  additional_comments text null,
  created_at timestamp with time zone null default now(),
  constraint termination_feedback_pkey primary key (id),
  constraint termination_feedback_employer_id_fkey foreign KEY (employer_id) references employer_onboarding (id) on delete CASCADE,
  constraint termination_feedback_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;