
-- ============================================================
-- PHASE 1: Bridge employers <-> employer_onboarding
-- ============================================================

-- 1. Add the bridge column (nullable — safe for existing rows)
ALTER TABLE employers
  ADD COLUMN IF NOT EXISTS onboarding_id UUID;

-- 2. Populate onboarding_id by matching on user_id,
--    picking the most-recent non-deleted onboarding record
WITH ranked AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY
        deleted_at IS NOT NULL,   -- prefer non-deleted first
        created_at DESC           -- then most recent
    ) AS rn
  FROM employer_onboarding
)
UPDATE employers e
SET onboarding_id = r.id
FROM ranked r
WHERE r.user_id = e.user_id
  AND r.rn = 1
  AND e.onboarding_id IS NULL;

-- 3. Add FK constraint (deferred to avoid ordering issues)
ALTER TABLE employers
  ADD CONSTRAINT employers_onboarding_id_fkey
  FOREIGN KEY (onboarding_id)
  REFERENCES employer_onboarding(id)
  ON DELETE SET NULL;

-- 4. Unique index: one live onboarding record per employer
CREATE UNIQUE INDEX IF NOT EXISTS employers_onboarding_id_unique
  ON employers (onboarding_id)
  WHERE onboarding_id IS NOT NULL;

-- ============================================================
-- 5. Create employer_full view — single source of truth
--    for all routes that currently dual-query both tables
-- ============================================================
CREATE OR REPLACE VIEW employer_full AS
SELECT
  -- Core identity from employers (authoritative)
  e.id,
  e.user_id,
  e.company_code,
  e.email,
  e.phone,
  e.status,
  e.is_verified,
  e.organization_id,
  e.created_at,
  e.updated_at,

  -- Rich onboarding profile fields
  eo.id                        AS onboarding_id,
  eo.company_name,
  eo.registration_number,
  eo.date_of_incorporation,
  eo.country,
  eo.physical_address,
  eo.city,
  eo.postal_code,
  eo.county_region,
  eo.tax_id,
  eo.vat_number,
  eo.industry,
  eo.sector,
  eo.business_description,
  eo.years_in_operation,
  eo.employee_count,
  eo.annual_revenue_range,
  eo.payroll_cycle,
  eo.monthly_payroll_amount,
  eo.bank_name,
  eo.bank_account_number,
  eo.contact_person,
  eo.contact_email,
  eo.contact_position,
  eo.contact_phone,
  eo.currency,

  -- KYC document flags
  eo.certificate_of_incorporation,
  eo.business_registration,
  eo.tax_compliance_certificate,
  eo.cr12_document,
  eo.kra_pin_certificate,
  eo.business_permit,
  eo.audited_financials,
  eo.bank_statement,
  eo.proof_of_address,
  eo.proof_of_bank_account,
  eo.employment_contract_template,

  -- Risk & scoring
  eo.risk_score,
  eo.risk_rating,

  -- Onboarding lifecycle
  eo.status                    AS onboarding_status,
  eo.current_step,
  eo.submitted_at,
  eo.reviewed_at,
  eo.reviewed_by,
  eo.review_notes,
  eo.terms_accepted_at,

  -- EWA settings (currently on employer_onboarding)
  eo.max_advance_percentage,
  eo.min_advance_amount,
  eo.advance_access_days,
  eo.cooldown_period,
  eo.settings,

  -- Notification preferences
  eo.email_notifications,
  eo.advance_alerts,
  eo.payroll_reminders,
  eo.weekly_reports

FROM employers e
LEFT JOIN employer_onboarding eo ON eo.id = e.onboarding_id;

-- ============================================================
-- 6. Comment for future devs
-- ============================================================
COMMENT ON COLUMN employers.onboarding_id IS
  'FK to employer_onboarding.id — bridges the live employer record to its onboarding/KYC profile. Use the employer_full view instead of querying both tables separately.';

COMMENT ON VIEW employer_full IS
  'Unified view joining employers (authoritative identity/status) with employer_onboarding (KYC, settings, risk). API routes should query this view instead of either table directly.';

