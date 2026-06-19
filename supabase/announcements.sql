create table public.announcements (
  id uuid not null default extensions.uuid_generate_v4 (),
  author_id uuid not null,
  title text not null,
  content text not null,
  is_draft boolean null default true,
  published_at timestamp with time zone null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  constraint announcements_pkey primary key (id),
  constraint announcements_author_id_fkey foreign KEY (author_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger update_announcements_updated_at BEFORE
update on announcements for EACH row
execute FUNCTION update_updated_at ();