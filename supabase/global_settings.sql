create table public.global_settings (
  id text not null default 'default'::text,
  platform_settings jsonb not null default '{}'::jsonb,
  risk_settings jsonb not null default '{}'::jsonb,
  notification_settings jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone not null default now(),
  constraint global_settings_pkey primary key (id)
) TABLESPACE pg_default;

create trigger update_global_settings_updated_at BEFORE
update on global_settings for EACH row
execute FUNCTION update_updated_at_column ();