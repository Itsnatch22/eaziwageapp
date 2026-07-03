
-- ─────────────────────────────────────────────────────────────────
-- STEP 1: Add EWA settings columns to employers (operational table)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.employers
  ADD COLUMN IF NOT EXISTS advance_limit_percent   integer         NOT NULL DEFAULT 50
    CHECK (advance_limit_percent >= 0 AND advance_limit_percent <= 100),
  ADD COLUMN IF NOT EXISTS cooldown_days           integer         NOT NULL DEFAULT 7
    CHECK (cooldown_days >= 0),
  ADD COLUMN IF NOT EXISTS min_advance_amount      numeric         NOT NULL DEFAULT 500
    CHECK (min_advance_amount >= 0),
  ADD COLUMN IF NOT EXISTS processing_fee          numeric         NOT NULL DEFAULT 4.5,
  ADD COLUMN IF NOT EXISTS funding_model           text            NOT NULL DEFAULT 'prefunded'
    CHECK (funding_model IN ('prefunded', 'debit_order', 'invoice')),
  ADD COLUMN IF NOT EXISTS risk_tier               text            NOT NULL DEFAULT 'low'
    CHECK (risk_tier IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS credit_limit            numeric         NOT NULL DEFAULT 5000000,
  ADD COLUMN IF NOT EXISTS funding_buffer_percent  integer         NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS max_monthly_advances    integer         NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS employee_advance_limit_min integer      NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS employee_advance_limit_max integer      NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS employee_cooldown_min   integer         NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS employee_cooldown_max   integer         NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS ewa_enabled             boolean         NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS instant_enabled         boolean         NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_approve            boolean         NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekend_access          boolean         NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────
-- STEP 2: Seed from employer_onboarding where linked via onboarding_id
-- ─────────────────────────────────────────────────────────────────
UPDATE public.employers e
SET
  advance_limit_percent  = COALESCE(eo.max_advance_percentage, 50),
  cooldown_days          = COALESCE(eo.cooldown_period, 7),
  min_advance_amount     = COALESCE(eo.min_advance_amount, 500)
FROM public.employer_onboarding eo
WHERE e.onboarding_id = eo.id;

-- ─────────────────────────────────────────────────────────────────
-- STEP 3: Add employee_id column to employee_ewa_settings
--         (points to employees.id — the operational table)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.employee_ewa_settings
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────
-- STEP 4: Seed employee_id by matching via user_id through employee_onboarding
-- ─────────────────────────────────────────────────────────────────
UPDATE public.employee_ewa_settings ees
SET employee_id = e.id
FROM public.employee_onboarding eo
JOIN public.employees e ON e.user_id = eo.user_id
WHERE ees.employee_onboarding_id = eo.id
  AND e.id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- STEP 5: Add employer_live_id column to employee_ewa_settings
--         (points to employers.id — the operational table)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.employee_ewa_settings
  ADD COLUMN IF NOT EXISTS employer_live_id uuid REFERENCES public.employers(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────
-- STEP 6: Seed employer_live_id via onboarding_id linkage
-- ─────────────────────────────────────────────────────────────────
UPDATE public.employee_ewa_settings ees
SET employer_live_id = emp.id
FROM public.employers emp
WHERE emp.onboarding_id = ees.employer_id
  AND emp.id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- STEP 7: Index the new FKs for query performance
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_employee_ewa_settings_employee_id
  ON public.employee_ewa_settings(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_ewa_settings_employer_live_id
  ON public.employee_ewa_settings(employer_live_id);

CREATE INDEX IF NOT EXISTS idx_employers_advance_limit
  ON public.employers(advance_limit_percent);

