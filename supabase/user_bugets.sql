create table public.user_budgets (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  monthly_income numeric(10, 2) not null default 0,
  categories jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_budgets_pkey primary key (id),
  constraint user_budgets_user_id_key unique (user_id),
  constraint user_budgets_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_budgets_user_id on public.user_budgets using btree (user_id) TABLESPACE pg_default;