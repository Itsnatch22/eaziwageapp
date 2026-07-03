
-- ============================================================
-- Soft-delete enforcement: employer_onboarding
-- Shared trigger function checks the parent employer_onboarding
-- row via the child's FK column (employer_id or onboarding_id).
-- Fires BEFORE INSERT on all 12 child tables.
-- ============================================================

CREATE OR REPLACE FUNCTION guard_employer_onboarding_not_deleted()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_employer_onboarding_id uuid;
  v_deleted_at timestamptz;
BEGIN
  -- Resolve the FK column — different child tables use different column names
  v_employer_onboarding_id := CASE TG_TABLE_NAME
    WHEN 'employer_beneficial_owners' THEN NEW.onboarding_id
    ELSE NEW.employer_id
  END;

  SELECT deleted_at INTO v_deleted_at
  FROM employer_onboarding
  WHERE id = v_employer_onboarding_id;

  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION
      'Insert rejected: employer_onboarding record (id=%) has been soft-deleted at %. '
      'No new child records may be created for a deleted employer.',
      v_employer_onboarding_id, v_deleted_at;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach to all child tables
CREATE TRIGGER trg_guard_deleted_employer_onboarding
  BEFORE INSERT ON employee_onboarding
  FOR EACH ROW EXECUTE FUNCTION guard_employer_onboarding_not_deleted();

CREATE TRIGGER trg_guard_deleted_employer_onboarding
  BEFORE INSERT ON employee_ewa_settings
  FOR EACH ROW EXECUTE FUNCTION guard_employer_onboarding_not_deleted();

CREATE TRIGGER trg_guard_deleted_employer_onboarding
  BEFORE INSERT ON bank_change_requests
  FOR EACH ROW EXECUTE FUNCTION guard_employer_onboarding_not_deleted();

CREATE TRIGGER trg_guard_deleted_employer_onboarding
  BEFORE INSERT ON employer_beneficial_owners
  FOR EACH ROW EXECUTE FUNCTION guard_employer_onboarding_not_deleted();

CREATE TRIGGER trg_guard_deleted_employer_onboarding
  BEFORE INSERT ON employer_risk_factors
  FOR EACH ROW EXECUTE FUNCTION guard_employer_onboarding_not_deleted();

CREATE TRIGGER trg_guard_deleted_employer_onboarding
  BEFORE INSERT ON employer_wallets
  FOR EACH ROW EXECUTE FUNCTION guard_employer_onboarding_not_deleted();

CREATE TRIGGER trg_guard_deleted_employer_onboarding
  BEFORE INSERT ON payroll_integrations
  FOR EACH ROW EXECUTE FUNCTION guard_employer_onboarding_not_deleted();

CREATE TRIGGER trg_guard_deleted_employer_onboarding
  BEFORE INSERT ON payroll_sync_logs
  FOR EACH ROW EXECUTE FUNCTION guard_employer_onboarding_not_deleted();

CREATE TRIGGER trg_guard_deleted_employer_onboarding
  BEFORE INSERT ON payroll_upload_rows
  FOR EACH ROW EXECUTE FUNCTION guard_employer_onboarding_not_deleted();

CREATE TRIGGER trg_guard_deleted_employer_onboarding
  BEFORE INSERT ON payroll_uploads
  FOR EACH ROW EXECUTE FUNCTION guard_employer_onboarding_not_deleted();

CREATE TRIGGER trg_guard_deleted_employer_onboarding
  BEFORE INSERT ON risk_review_requests
  FOR EACH ROW EXECUTE FUNCTION guard_employer_onboarding_not_deleted();

CREATE TRIGGER trg_guard_deleted_employer_onboarding
  BEFORE INSERT ON termination_feedback
  FOR EACH ROW EXECUTE FUNCTION guard_employer_onboarding_not_deleted();

