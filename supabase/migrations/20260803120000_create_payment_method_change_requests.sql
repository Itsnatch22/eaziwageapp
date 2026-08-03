create table if not exists public.payment_method_change_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  payment_method_id uuid not null references public.payment_methods(id) on delete cascade,
  requested_method_type text not null check (requested_method_type in ('mobile_money', 'bank_account')),
  old_provider_name text,
  new_provider_name text not null,
  old_phone_number text,
  new_phone_number text,
  old_account_number text,
  new_account_number text,
  old_account_name text,
  new_account_name text,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_method_change_requests_employee_id_idx
  on public.payment_method_change_requests (employee_id);

create index if not exists payment_method_change_requests_status_idx
  on public.payment_method_change_requests (status);
