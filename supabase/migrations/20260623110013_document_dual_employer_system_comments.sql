
COMMENT ON TABLE employer_onboarding IS
  'Pre-approval KYC/onboarding workflow entity. Used as FK target by payroll, 
   wallet, and EWA settings tables during the onboarding phase. 
   Approved records graduate to the employers table; the link is tracked 
   via employers.onboarding_id.';

COMMENT ON TABLE employers IS
  'Live employer record, created only upon onboarding approval. 
   FK target for all operational tables (advances, employees, fraud_flags, 
   policies, repayments, employee_ewa_settings.employer_live_id). 
   Links back to its onboarding source via onboarding_id (nullable for 
   directly-provisioned employers).';

