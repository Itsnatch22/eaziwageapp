
-- Fix default on admin_wallets currency column
ALTER TABLE public.admin_wallets
  ALTER COLUMN currency SET DEFAULT 'USD';

-- Update the live row
UPDATE public.admin_wallets
SET currency = 'USD', updated_at = NOW()
WHERE name = 'Main Stanbic Source';

