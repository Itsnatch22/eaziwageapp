
-- v_employer_config — unified employer config view (Phase 1 of employer table consolidation)
--
-- employers           →  advance_limit_percent, cooldown_days  (live operational config)
-- employer_onboarding →  max_advance_percentage, cooldown_period  (KYC/onboarding snapshot)
--
-- COALESCEs live employers values first, falls back to onboarding when employers row
-- is not yet fully populated.

CREATE OR REPLACE VIEW v_employer_config AS
SELECT
  e.id,
  e.user_id,
  e.onboarding_id,
  e.status,
  e.company_code,

  COALESCE(e.advance_limit_percent,  o.max_advance_percentage, 50)::numeric(5,2)  AS advance_limit_percent,
  COALESCE(e.cooldown_days,          o.cooldown_period,         7)::integer        AS cooldown_days,
  COALESCE(e.min_advance_amount,     o.min_advance_amount,      0)::numeric(12,2)  AS min_advance_amount,

  e.processing_fee,
  e.ewa_enabled,
  e.disbursements_frozen,
  e.freeze_reason,
  e.is_defaulted,
  e.auto_approve,
  e.weekend_access,
  e.max_monthly_advances,

  COALESCE(e.payroll_cycle,  o.payroll_cycle)  AS payroll_cycle,
  COALESCE(e.risk_score,     o.risk_score)     AS risk_score,
  COALESCE(e.risk_rating,    o.risk_rating)    AS risk_rating,

  o.company_name,
  o.contact_person,
  o.contact_email,
  o.contact_phone,
  o.industry,
  o.country,
  o.currency,
  o.registration_number,
  o.physical_address

FROM employers e
LEFT JOIN employer_onboarding o ON o.id = e.onboarding_id;

