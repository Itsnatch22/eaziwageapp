create table public.risk_review_requests (
  id uuid not null default gen_random_uuid (),
  employer_id uuid not null,
  user_id uuid not null,
  type text not null default 'risk_review'::text,
  message text null,
  status text not null default 'pending'::text,
  resolved_by uuid null,
  resolved_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint risk_review_requests_pkey primary key (id),
  constraint risk_review_requests_employer_id_fkey foreign KEY (employer_id) references employer_onboarding (id) on delete CASCADE,
  constraint risk_review_requests_resolved_by_fkey foreign KEY (resolved_by) references auth.users (id),
  constraint risk_review_requests_user_id_fkey foreign KEY (user_id) references auth.users (id),
  constraint risk_review_requests_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'in_progress'::text,
          'resolved'::text,
          'dismissed'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_review_requests_employer_status on public.risk_review_requests using btree (employer_id, status) TABLESPACE pg_default;

create index IF not exists idx_review_requests_status_created on public.risk_review_requests using btree (status, created_at desc) TABLESPACE pg_default;