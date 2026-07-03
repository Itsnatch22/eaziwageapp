
-- Issues 3–6: add employer_live_id to all payroll + operational tables and backfill.
-- These tables currently point employer_id → employer_onboarding.id.
-- employer_live_id → employers.id gives a direct path to the live entity.

ALTER TABLE payroll_integrations ADD COLUMN IF NOT EXISTS employer_live_id uuid REFERENCES employers(id);
ALTER TABLE payroll_sync_logs    ADD COLUMN IF NOT EXISTS employer_live_id uuid REFERENCES employers(id);
ALTER TABLE payroll_uploads      ADD COLUMN IF NOT EXISTS employer_live_id uuid REFERENCES employers(id);
ALTER TABLE payroll_upload_rows  ADD COLUMN IF NOT EXISTS employer_live_id uuid REFERENCES employers(id);
ALTER TABLE bank_change_requests  ADD COLUMN IF NOT EXISTS employer_live_id uuid REFERENCES employers(id);
ALTER TABLE employer_risk_factors ADD COLUMN IF NOT EXISTS employer_live_id uuid REFERENCES employers(id);
ALTER TABLE risk_review_requests  ADD COLUMN IF NOT EXISTS employer_live_id uuid REFERENCES employers(id);
ALTER TABLE termination_feedback  ADD COLUMN IF NOT EXISTS employer_live_id uuid REFERENCES employers(id);

UPDATE payroll_integrations t SET employer_live_id = e.id
FROM employer_onboarding eob JOIN employers e ON e.onboarding_id = eob.id
WHERE t.employer_id = eob.id AND t.employer_live_id IS NULL;

UPDATE payroll_sync_logs t SET employer_live_id = e.id
FROM employer_onboarding eob JOIN employers e ON e.onboarding_id = eob.id
WHERE t.employer_id = eob.id AND t.employer_live_id IS NULL;

UPDATE payroll_uploads t SET employer_live_id = e.id
FROM employer_onboarding eob JOIN employers e ON e.onboarding_id = eob.id
WHERE t.employer_id = eob.id AND t.employer_live_id IS NULL;

UPDATE payroll_upload_rows t SET employer_live_id = e.id
FROM employer_onboarding eob JOIN employers e ON e.onboarding_id = eob.id
WHERE t.employer_id = eob.id AND t.employer_live_id IS NULL;

UPDATE bank_change_requests t SET employer_live_id = e.id
FROM employer_onboarding eob JOIN employers e ON e.onboarding_id = eob.id
WHERE t.employer_id = eob.id AND t.employer_live_id IS NULL;

UPDATE employer_risk_factors t SET employer_live_id = e.id
FROM employer_onboarding eob JOIN employers e ON e.onboarding_id = eob.id
WHERE t.employer_id = eob.id AND t.employer_live_id IS NULL;

UPDATE risk_review_requests t SET employer_live_id = e.id
FROM employer_onboarding eob JOIN employers e ON e.onboarding_id = eob.id
WHERE t.employer_id = eob.id AND t.employer_live_id IS NULL;

UPDATE termination_feedback t SET employer_live_id = e.id
FROM employer_onboarding eob JOIN employers e ON e.onboarding_id = eob.id
WHERE t.employer_id = eob.id AND t.employer_live_id IS NULL;

