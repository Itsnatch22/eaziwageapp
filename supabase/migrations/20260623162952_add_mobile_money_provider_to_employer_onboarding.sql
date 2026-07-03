ALTER TABLE employer_onboarding
  ADD COLUMN IF NOT EXISTS mobile_money_provider TEXT;

COMMENT ON COLUMN employer_onboarding.mobile_money_provider IS 'Mobile money provider for EWA disbursement reimbursement (e.g. M-PESA, Airtel Money, MTN MoMo)';
