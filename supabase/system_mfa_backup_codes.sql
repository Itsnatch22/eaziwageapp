create table public.system_mfa_backup_codes (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  code_hash text not null,
  used boolean not null default false,
  used_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint system_mfa_backup_codes_pkey primary key (id),
  constraint system_mfa_backup_codes_user_code_hash_key unique (user_id, code_hash),
  constraint system_mfa_backup_codes_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_system_mfa_backup_codes_user_id on public.system_mfa_backup_codes using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_system_mfa_backup_codes_used on public.system_mfa_backup_codes using btree (used) TABLESPACE pg_default;

create index IF not exists idx_system_mfa_backup_codes_created_at on public.system_mfa_backup_codes using btree (created_at desc) TABLESPACE pg_default;