create table public.notifications (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  type text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint notifications_pkey primary key (id),
  constraint notifications_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists notifications_user_id_idx on public.notifications using btree (user_id) TABLESPACE pg_default;

create index IF not exists notifications_created_at_idx on public.notifications using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists notifications_user_read_idx on public.notifications using btree (user_id, read) TABLESPACE pg_default;

create trigger set_notifications_created_at BEFORE INSERT on notifications for EACH row
execute FUNCTION set_created_at ();