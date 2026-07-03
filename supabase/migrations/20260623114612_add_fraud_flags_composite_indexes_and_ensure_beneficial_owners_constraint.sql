
-- ============================================================
-- 4.5: fraud_flags — composite index on (employee_id, status)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_fraud_flags_employee_status 
  ON fraud_flags (employee_id, status);

-- Bonus: employer_id + status for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_fraud_flags_employer_status
  ON fraud_flags (employer_id, status);

-- Bonus: open flags sorted by severity + time (hot path for fraud review queue)
CREATE INDEX IF NOT EXISTS idx_fraud_flags_status_severity_created
  ON fraud_flags (status, severity, created_at DESC)
  WHERE status = 'open';

-- ============================================================
-- 5.1: employer_beneficial_owners — unique constraint
-- Already exists as uq_owner_onboarding_id_number — idempotent guard
-- ============================================================
ALTER TABLE employer_beneficial_owners
  DROP CONSTRAINT IF EXISTS uq_owner_onboarding_id_number;

ALTER TABLE employer_beneficial_owners
  ADD CONSTRAINT uq_owner_onboarding_id_number 
  UNIQUE (onboarding_id, id_number);

