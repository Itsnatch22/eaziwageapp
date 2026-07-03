
-- advances.created_at
ALTER TABLE public.advances
  ALTER COLUMN created_at SET DEFAULT NOW();

-- dusupay_transactions.created_at
ALTER TABLE public.dusupay_transactions
  ALTER COLUMN created_at SET DEFAULT NOW();

-- employees.created_at
ALTER TABLE public.employees
  ALTER COLUMN created_at SET DEFAULT NOW();

-- policies.created_at
ALTER TABLE public.policies
  ALTER COLUMN created_at SET DEFAULT NOW();

-- admin_wallets.updated_at
ALTER TABLE public.admin_wallets
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- system_admins.created_at
ALTER TABLE public.system_admins
  ALTER COLUMN created_at SET DEFAULT NOW();

-- profiles.is_active
ALTER TABLE public.profiles
  ALTER COLUMN is_active SET DEFAULT true;

-- employers.is_verified
ALTER TABLE public.employers
  ALTER COLUMN is_verified SET DEFAULT false;

-- organizations.is_frozen
ALTER TABLE public.organizations
  ALTER COLUMN is_frozen SET DEFAULT false;

