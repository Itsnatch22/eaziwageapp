create table if not exists onboarding_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  tester_name text,
  tester_email text,
  reviewed_pages text[] not null default '{}',
  answers jsonb not null,
  user_ip text,
  user_agent text,
  submitted_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table onboarding_feedback
  add column if not exists tester_name text,
  add column if not exists tester_email text,
  add column if not exists reviewed_pages text[] not null default '{}',
  add column if not exists submitted_at timestamp with time zone not null default timezone('utc'::text, now());

alter table onboarding_feedback
  alter column user_id drop not null;

comment on table onboarding_feedback is 'Beta onboarding feedback survey submissions from testers.';
comment on column onboarding_feedback.tester_name is 'Name supplied by the beta tester when submitting feedback.';
comment on column onboarding_feedback.tester_email is 'Email supplied by the beta tester when submitting feedback.';
comment on column onboarding_feedback.reviewed_pages is 'Pages the tester says they reviewed before answering.';
