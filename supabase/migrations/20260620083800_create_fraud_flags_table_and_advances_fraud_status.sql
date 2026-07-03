
-- Create fraud_flags table for the admin fraud detection page.
-- A fraud flag suspends auto-disbursement and requires manual EaziWage admin approval.

CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id uuid NOT NULL REFERENCES public.advances(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  employer_id uuid REFERENCES public.employers(id),
  flag_type text NOT NULL,
  -- flag_type values: 'velocity' | 'risk_score_threshold' | 'kyc_mismatch' |
  --                   'employer_not_linked' | 'unverified_payment_method' |
  --                   'manual_report' | 'pattern_anomaly'
  severity text NOT NULL DEFAULT 'medium',
  -- severity values: 'low' | 'medium' | 'high' | 'critical'
  description text NOT NULL,
  triggered_by text NOT NULL DEFAULT 'system',
  -- triggered_by: 'system' | 'admin:{admin_user_id}'
  status text NOT NULL DEFAULT 'open',
  -- status: 'open' | 'reviewed' | 'cleared' | 'confirmed_fraud'
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fraud_flags IS
  'Fraud detection records. A flagged advance is held in fraud_review status until an EaziWage admin clears or confirms it. Confirmed fraud locks the employee from future advances.';

-- Indexes for the fraud detection admin page
CREATE INDEX IF NOT EXISTS idx_fraud_flags_advance_id ON public.fraud_flags(advance_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_employee_id ON public.fraud_flags(employee_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_employer_id ON public.fraud_flags(employer_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_status ON public.fraud_flags(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_fraud_flags_severity ON public.fraud_flags(severity);

-- Add fraud_review to advances status and add fraud_cleared_by for audit trail
ALTER TABLE public.advances
  ADD COLUMN IF NOT EXISTS fraud_flag_id uuid REFERENCES public.fraud_flags(id),
  ADD COLUMN IF NOT EXISTS fraud_cleared_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS fraud_cleared_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_approved boolean NOT NULL DEFAULT false;
-- auto_approved: true = system auto-approved, false = required manual EaziWage review

COMMENT ON COLUMN public.advances.auto_approved IS
  'True when the disbursement was auto-approved by the system (no fraud flags, all checks passed). False means an EaziWage admin manually reviewed and approved.';

COMMENT ON COLUMN public.advances.fraud_flag_id IS
  'If set, this advance was held for fraud review. References the fraud_flags record.';

-- Create employer_repayments table to track month-end remittances
-- This replaces the repurposed wallet_transactions for repayment tracking
CREATE TABLE IF NOT EXISTS public.employer_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES public.employers(id),
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  -- status: 'pending' | 'received' | 'partial' | 'defaulted'
  reference text,
  -- Bank transfer reference from employer
  received_at timestamptz,
  recorded_by uuid REFERENCES auth.users(id),
  notes text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.employer_repayments IS
  'Month-end repayment records. Employer remits total advanced amount back to EaziWage Stanbic account. Admin records receipt here. Defaulted records trigger disbursement freeze.';

CREATE INDEX IF NOT EXISTS idx_employer_repayments_employer_id ON public.employer_repayments(employer_id);
CREATE INDEX IF NOT EXISTS idx_employer_repayments_status ON public.employer_repayments(status);
CREATE INDEX IF NOT EXISTS idx_employer_repayments_period ON public.employer_repayments(period_start, period_end);

