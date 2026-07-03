
-- Repurpose employer_wallets from pre-funded wallet to liability tracker.
-- Employers never hold funds — EaziWage advances on their behalf and tracks what's owed.

-- Rename balance → total_advanced (cumulative amount EaziWage has disbursed for this employer)
ALTER TABLE public.employer_wallets
  RENAME COLUMN balance TO total_advanced;

-- Rename arrears_balance → outstanding_liability (what employer still owes EaziWage)
ALTER TABLE public.employer_wallets
  RENAME COLUMN arrears_balance TO outstanding_liability;

-- Add repayment tracking columns
ALTER TABLE public.employer_wallets
  ADD COLUMN IF NOT EXISTS total_repaid numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_repayment_at timestamptz,
  ADD COLUMN IF NOT EXISTS repayment_due_date date,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Comment the table to make intent explicit for future devs
COMMENT ON TABLE public.employer_wallets IS
  'Tracks EaziWage liability exposure per employer. Not a pre-funded wallet — employers never hold funds. EaziWage disburses to employees and tracks what each employer owes at month-end.';

COMMENT ON COLUMN public.employer_wallets.total_advanced IS
  'Cumulative amount EaziWage has disbursed to employees on behalf of this employer (local currency).';

COMMENT ON COLUMN public.employer_wallets.outstanding_liability IS
  'Amount currently owed by employer to EaziWage. Increases on each disbursement, decreases on repayment.';

COMMENT ON COLUMN public.employer_wallets.total_repaid IS
  'Cumulative amount employer has remitted back to EaziWage Stanbic account.';

