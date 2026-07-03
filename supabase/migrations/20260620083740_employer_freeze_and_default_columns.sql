
-- Add disbursement freeze and default tracking to employers table.
-- When an employer defaults on month-end repayment, all employee disbursements
-- linked to that employer are frozen until the debt is cleared.

ALTER TABLE public.employers
  ADD COLUMN IF NOT EXISTS disbursements_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS freeze_reason text,
  ADD COLUMN IF NOT EXISTS frozen_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_defaulted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS defaulted_at timestamptz,
  ADD COLUMN IF NOT EXISTS default_amount numeric(18,2);

COMMENT ON COLUMN public.employers.disbursements_frozen IS
  'When true, no advance disbursements are processed for any employee under this employer.';

COMMENT ON COLUMN public.employers.is_defaulted IS
  'True when employer has missed month-end repayment. Triggers disbursement freeze automatically.';

COMMENT ON COLUMN public.employers.default_amount IS
  'Outstanding amount at the time of default.';

-- Index for fast freeze check during disbursement pipeline
CREATE INDEX IF NOT EXISTS idx_employers_disbursements_frozen
  ON public.employers(disbursements_frozen)
  WHERE disbursements_frozen = true;

