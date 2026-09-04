create table if not exists beta_disbursement_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  tester_name text not null,
  tester_email text not null,
  reviewed_pages text[] not null default '{}',
  answers jsonb not null,
  user_ip text,
  user_agent text,
  submitted_at timestamptz not null default timezone('utc'::text, now())
);

alter table beta_disbursement_feedback enable row level security;

comment on table beta_disbursement_feedback is 'Beta disbursement-flow feedback submissions from testers.';
comment on column beta_disbursement_feedback.answers is 'Validated beta disbursement survey answers.';
