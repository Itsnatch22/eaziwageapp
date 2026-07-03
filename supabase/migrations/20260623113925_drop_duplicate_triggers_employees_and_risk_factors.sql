
-- ============================================================
-- 3.1: employees — drop the duplicate updated_at trigger only
-- Both set_updated_at() and update_updated_at() are load-bearing
-- across many tables — DO NOT drop either function.
-- t2 fires set_updated_at(); trg_employees_updated_at fires update_updated_at()
-- Both do NEW.updated_at = now(). Drop t2, keep trg_employees_updated_at.
-- ============================================================
DROP TRIGGER IF EXISTS t2 ON employees;

-- ============================================================
-- 3.2: employer_risk_factors — drop duplicate risk score sync trigger
-- sync_risk_score_on_upsert and trg_sync_risk_score are identical in logic.
-- trg_sync_risk_score / fn_sync_employer_risk_score is the canonical pair.
-- Dropping the older trigger only — fn_sync_employer_risk_score stays.
-- sync_employer_risk_score() has no other dependents — safe to drop.
-- ============================================================
DROP TRIGGER IF EXISTS sync_risk_score_on_upsert ON employer_risk_factors;
DROP FUNCTION IF EXISTS sync_employer_risk_score();

