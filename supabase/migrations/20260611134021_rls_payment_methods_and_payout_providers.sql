
-- ============================================================
-- RLS: payout_providers (reference/config table)
-- ============================================================
alter table public.payout_providers enable row level security;

-- everyone authenticated can read providers
create policy "Anyone can view payout providers"
  on public.payout_providers for select
  to authenticated
  using (true);

-- only admins can mutate
create policy "Admins can manage payout providers"
  on public.payout_providers for all
  to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

-- ============================================================
-- RLS: payment_methods
-- ============================================================
alter table public.payment_methods enable row level security;

-- employees can CRUD their own payment methods
create policy "Employees can manage own payment methods"
  on public.payment_methods for all
  to authenticated
  using (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  )
  with check (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

-- employers can view and update their employees' payment methods
create policy "Employers can view their employees payment methods"
  on public.payment_methods for select
  to authenticated
  using (
    employee_id in (
      select id from public.employees where user_owns_employer_record(employer_id)
    )
  );

create policy "Employers can update their employees payment methods"
  on public.payment_methods for update
  to authenticated
  using (
    employee_id in (
      select id from public.employees where user_owns_employer_record(employer_id)
    )
  )
  with check (
    employee_id in (
      select id from public.employees where user_owns_employer_record(employer_id)
    )
  );

-- admins get full access
create policy "Admins have full access to payment methods"
  on public.payment_methods for all
  to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

-- ============================================================
-- RLS: payment_method_audit
-- ============================================================
alter table public.payment_method_audit enable row level security;

-- employees can view their own audit trail
create policy "Employees can view own payment method audit"
  on public.payment_method_audit for select
  to authenticated
  using (
    employee_id in (
      select id from public.employees where user_id = auth.uid()
    )
  );

-- admins get full access
create policy "Admins have full access to payment method audit"
  on public.payment_method_audit for all
  to authenticated
  using (current_user_is_admin())
  with check (current_user_is_admin());

