-- Table to store hashed MFA backup codes per user
-- Each code is stored as a SHA-256 hash; plain codes are shown to the user once on generation only.

create table public.system_mfa_backup_codes (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  code_hash text not null,
  used boolean not null default false,
  used_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  constraint system_mfa_backup_codes_pkey primary key (id),
  constraint system_mfa_backup_codes_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint system_mfa_backup_codes_user_code_hash_key unique (user_id, code_hash)
) TABLESPACE pg_default;

create index if not exists idx_system_mfa_backup_codes_user_id on public.system_mfa_backup_codes using btree (user_id) TABLESPACE pg_default;
create index if not exists idx_system_mfa_backup_codes_used on public.system_mfa_backup_codes using btree (used) TABLESPACE pg_default;
create index if not exists idx_system_mfa_backup_codes_created_at on public.system_mfa_backup_codes using btree (created_at desc) TABLESPACE pg_default;

-- RLS
alter table public.system_mfa_backup_codes enable row level security;

create policy "Users can view their own backup codes"
  on public.system_mfa_backup_codes
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users cannot insert backup codes directly"
  on public.system_mfa_backup_codes
  for insert
  to authenticated
  with check (false);

create policy "Users can update their own backup codes"
  on public.system_mfa_backup_codes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

