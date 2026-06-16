-- Migration to fix activation flow and single source of truth for is_active
-- 1. Update profiles.is_active default to false
ALTER TABLE public.profiles ALTER COLUMN is_active SET DEFAULT false;

-- 2. Audit existing profiles: set is_active = true for approved users and admins
-- Activate approved employers
UPDATE public.profiles p
SET is_active = true, onboarding_complete = true
FROM public.employer_onboarding eo
WHERE p.id = eo.user_id AND eo.status = 'approved';

-- Activate approved employees
UPDATE public.profiles p
SET is_active = true, onboarding_complete = true
FROM public.employee_onboarding eo
WHERE p.id = eo.user_id AND eo.status = 'approved';

-- Activate admins
UPDATE public.profiles
SET is_active = true, onboarding_complete = true
WHERE role = 'admin' OR is_admin = true;

-- 3. Relax NOT NULL constraints on employee_onboarding to allow atomic creation at signup
ALTER TABLE public.employee_onboarding ALTER COLUMN employer_id DROP NOT NULL;
ALTER TABLE public.employee_onboarding ALTER COLUMN national_id DROP NOT NULL;
ALTER TABLE public.employee_onboarding ALTER COLUMN date_of_birth DROP NOT NULL;
ALTER TABLE public.employee_onboarding ALTER COLUMN country DROP NOT NULL;
ALTER TABLE public.employee_onboarding ALTER COLUMN address_line1 DROP NOT NULL;
ALTER TABLE public.employee_onboarding ALTER COLUMN job_title DROP NOT NULL;
ALTER TABLE public.employee_onboarding ALTER COLUMN employment_type DROP NOT NULL;
ALTER TABLE public.employee_onboarding ALTER COLUMN monthly_salary DROP NOT NULL;
ALTER TABLE public.employee_onboarding ALTER COLUMN bank_name DROP NOT NULL;
ALTER TABLE public.employee_onboarding ALTER COLUMN bank_account DROP NOT NULL;
ALTER TABLE public.employee_onboarding ALTER COLUMN mobile_money_provider DROP NOT NULL;
ALTER TABLE public.employee_onboarding ALTER COLUMN mobile_money_number DROP NOT NULL;
