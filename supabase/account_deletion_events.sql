-- Account Deletion Events Table
-- Stores information about why users delete their accounts

create table public.account_deletion_events (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  user_email text not null,
  user_full_name text not null,
  user_role public.user_role not null,
  deletion_reason text not null,
  deletion_reason_category text not null, -- 'service_dissatisfaction', 'financial_issues', 'employment_change', 'privacy_concerns', 'other'
  additional_feedback text,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone not null default now(),
  constraint account_deletion_events_pkey primary key (id),
  constraint account_deletion_events_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
) TABLESPACE pg_default;

-- Indexes for performance
create index if not exists idx_account_deletion_events_user_id on public.account_deletion_events using btree (user_id);
create index if not exists idx_account_deletion_events_created_at on public.account_deletion_events using btree (created_at);
create index if not exists idx_account_deletion_events_reason_category on public.account_deletion_events using btree (deletion_reason_category);

-- RLS (Row Level Security) policies
alter table public.account_deletion_events enable row level security;

-- Only admins can view deletion events (for analytics)
create policy "Admins can view all deletion events" on public.account_deletion_events
  for select using (
    exists (
      select 1 from public.profiles 
      where profiles.id = auth.uid() 
      and profiles.is_admin = true
    )
  );

-- Users can insert their own deletion events
create policy "Users can insert their own deletion events" on public.account_deletion_events
  for insert with check (user_id = auth.uid());

-- No one can update deletion events (immutable record)
create policy "No updates allowed" on public.account_deletion_events
  for update using (false);

-- No one can delete deletion events (immutable record)
create policy "No deletes allowed" on public.account_deletion_events
  for delete using (false);
