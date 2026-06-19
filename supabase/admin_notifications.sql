create table public.admin_notifications (
  id uuid not null default gen_random_uuid (),
  type public.admin_notification_type not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamp with time zone not null default now(),
  metadata jsonb null,
  constraint admin_notifications_pkey primary key (id),
  constraint admin_notifications_message_check check (
    (
      (char_length(message) >= 1)
      and (char_length(message) <= 500)
    )
  ),
  constraint admin_notifications_title_check check (
    (
      (char_length(title) >= 1)
      and (char_length(title) <= 200)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_admin_notifications_created on public.admin_notifications using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists idx_admin_notifications_type on public.admin_notifications using btree (type, created_at desc) TABLESPACE pg_default;

create index IF not exists idx_admin_notifications_unread on public.admin_notifications using btree (created_at desc) TABLESPACE pg_default
where
  (read = false);