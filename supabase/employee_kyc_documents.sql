-- Employee KYC documents metadata used by:
-- - POST /api/employee-dashboard/kyc/documents
-- - GET  /api/employee-dashboard/kyc/documents
-- - PATCH /api/employee-dashboard/kyc/documents/:id/review

create extension if not exists pgcrypto;

create table if not exists public.employee_kyc_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null,
  document_url text not null,
  storage_path text not null,
  document_number text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, document_type)
);

create index if not exists idx_employee_kyc_documents_user_id
  on public.employee_kyc_documents(user_id);

create index if not exists idx_employee_kyc_documents_status
  on public.employee_kyc_documents(status);

create or replace function public.set_employee_kyc_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_employee_kyc_documents_updated_at on public.employee_kyc_documents;
create trigger trg_employee_kyc_documents_updated_at
before update on public.employee_kyc_documents
for each row
execute procedure public.set_employee_kyc_documents_updated_at();

alter table public.employee_kyc_documents enable row level security;

-- Employees can read only their own KYC documents.
drop policy if exists "employee_kyc_docs_select_own" on public.employee_kyc_documents;
create policy "employee_kyc_docs_select_own"
  on public.employee_kyc_documents
  for select
  using (auth.uid() = user_id);

-- Employees can insert/update only their own KYC docs (normal upload/update flow).
drop policy if exists "employee_kyc_docs_insert_own" on public.employee_kyc_documents;
create policy "employee_kyc_docs_insert_own"
  on public.employee_kyc_documents
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "employee_kyc_docs_update_own" on public.employee_kyc_documents;
create policy "employee_kyc_docs_update_own"
  on public.employee_kyc_documents
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
