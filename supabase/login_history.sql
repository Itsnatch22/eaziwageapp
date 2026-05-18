create table public.login_history (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid null,
  email character varying(255) not null,
  ip_address character varying(45) not null,
  user_agent text null,
  success boolean null default true,
  logged_in_at timestamp with time zone null default now(),
  location character varying(255) null,
  device_fingerprint text null,
  session_id uuid null,
  constraint login_history_pkey primary key (id),
  constraint login_history_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_login_history_email on public.login_history using btree (email) TABLESPACE pg_default;

create index IF not exists idx_login_history_ip on public.login_history using btree (ip_address) TABLESPACE pg_default;

create index IF not exists idx_login_history_logged_in_at on public.login_history using btree (logged_in_at desc) TABLESPACE pg_default;

create index IF not exists idx_login_history_user_id on public.login_history using btree (user_id) TABLESPACE pg_default;

create trigger set_login_history_timestamp BEFORE INSERT on login_history for EACH row
execute FUNCTION update_login_history_timestamp ();