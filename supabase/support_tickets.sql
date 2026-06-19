create table public.support_tickets (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  subject text not null,
  message text not null,
  category text not null default 'general'::text,
  status text not null default 'open'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint support_tickets_pkey primary key (id),
  constraint support_tickets_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint support_tickets_status_check check (
    (
      status = any (
        array[
          'open'::text,
          'in_progress'::text,
          'resolved'::text,
          'closed'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;