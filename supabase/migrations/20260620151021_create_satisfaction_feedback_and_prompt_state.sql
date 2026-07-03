-- Tracks eligibility/cooldown per user so we don't over-prompt
create table public.satisfaction_prompt_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prompt_count integer not null default 0,
  last_prompted_at timestamptz,
  last_response_at timestamptz,
  last_dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Stores actual responses
create table public.satisfaction_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role = ANY (ARRAY['employee'::text, 'employer'::text])),
  advance_id uuid references public.advances(id) on delete set null,
  sentiment text not null check (sentiment = ANY (ARRAY['positive'::text, 'negative'::text])),
  rating smallint check (rating between 1 and 5),
  comment text,
  support_ticket_id uuid references public.support_tickets(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_satisfaction_feedback_user_id on public.satisfaction_feedback(user_id);
create index idx_satisfaction_feedback_advance_id on public.satisfaction_feedback(advance_id);
create index idx_satisfaction_feedback_created_at on public.satisfaction_feedback(created_at);
create index idx_satisfaction_feedback_support_ticket_id on public.satisfaction_feedback(support_ticket_id);

alter table public.satisfaction_prompt_state enable row level security;
alter table public.satisfaction_feedback enable row level security;

-- prompt_state: users manage their own row, admins can read all
create policy "users_manage_own_prompt_state"
  on public.satisfaction_prompt_state for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admins_select_all_prompt_state"
  on public.satisfaction_prompt_state for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- feedback: users insert/read own, admins read all
create policy "users_insert_own_satisfaction_feedback"
  on public.satisfaction_feedback for insert
  with check (user_id = auth.uid());

create policy "users_select_own_satisfaction_feedback"
  on public.satisfaction_feedback for select
  using (user_id = auth.uid());

create policy "admins_select_all_satisfaction_feedback"
  on public.satisfaction_feedback for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admins_update_satisfaction_feedback"
  on public.satisfaction_feedback for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

