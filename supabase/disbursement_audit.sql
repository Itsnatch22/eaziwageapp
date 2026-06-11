-- Audit log for disbursement attempts

create table if not exists public.disbursement_audit (
  id uuid not null default gen_random_uuid(),
  advance_id uuid not null,
  payment_method_id uuid null,
  provider_key text null,
  attempt_at timestamp with time zone not null default now(),
  success boolean not null,
  provider_reference text null,
  response jsonb null,
  error text null,
  created_at timestamp with time zone not null default now(),
  constraint disbursement_audit_pkey primary key (id)
) tablespace pg_default;

create index if not exists idx_disbursement_audit_advance on public.disbursement_audit using btree (advance_id) tablespace pg_default;
