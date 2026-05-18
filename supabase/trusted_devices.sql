create table public.trusted_devices (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  device_fingerprint text not null,
  device_name text null,
  user_agent text null,
  ip_address text null,
  last_used_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  constraint trusted_devices_pkey primary key (id),
  constraint trusted_devices_user_id_device_fingerprint_key unique (user_id, device_fingerprint),
  constraint trusted_devices_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_trusted_devices_fingerprint on public.trusted_devices using btree (device_fingerprint) TABLESPACE pg_default;

create index IF not exists idx_trusted_devices_last_used on public.trusted_devices using btree (last_used_at desc) TABLESPACE pg_default;

create index IF not exists idx_trusted_devices_user_id on public.trusted_devices using btree (user_id) TABLESPACE pg_default;