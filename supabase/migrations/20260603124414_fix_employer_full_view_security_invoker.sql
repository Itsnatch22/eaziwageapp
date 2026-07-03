
-- Drop and recreate cleanly with SECURITY INVOKER
DROP VIEW IF EXISTS employer_full;

CREATE VIEW employer_full
WITH (security_invoker = true)
AS
SELECT
  e.id,
  e.user_id,
  e.company_code,
  e.email,
  e.phone,
  e.status,
  e.is_verified,
  e.organization_id,
  e.onboarding_id,
  e.created_at,
  e.updated_at,

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

  eo.risk_score,
  eo.risk_rating,

  eo.status                    AS onboarding_status,
  eo.current_step,
  eo.submitted_at,
  eo.reviewed_at,
  eo.reviewed_by,
  eo.review_notes,
  eo.terms_accepted_at,

  eo.max_advance_percentage,
  eo.min_advance_amount,
  eo.advance_access_days,
  eo.cooldown_period,
  eo.settings,

  eo.email_notifications,
  eo.advance_alerts,
  eo.payroll_reminders,
  eo.weekly_reports

FROM employers e
LEFT JOIN employer_onboarding eo ON eo.id = e.onboarding_id;

COMMENT ON VIEW employer_full IS
  'Unified view joining employers (identity/status) with employer_onboarding (KYC, settings, risk). Uses SECURITY INVOKER — RLS on both underlying tables is enforced for the calling user.';

