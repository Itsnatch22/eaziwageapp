-- KYC review, Risk Scoring, and employer/employee activation admin pages already
-- have useRealtimeRefresh subscriptions wired to these tables (KycReviewClient,
-- RiskScoringClient, EmployersClient, EmployeesClient, AdminLayout), but the tables
-- were never added to the supabase_realtime publication — so no change event ever
-- fired and the pages silently never refreshed. RLS is already enabled on all of
-- them (consistent with other already-published tables like employer_wallets).
ALTER PUBLICATION supabase_realtime ADD TABLE public.employer_onboarding;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_onboarding;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_kyc_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fraud_flags;
