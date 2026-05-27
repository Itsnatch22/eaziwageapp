-- Adds start_date column to public.employee_onboarding (idempotent)
-- Run this snippet in environments where public.employee_onboarding is missing start_date.

ALTER TABLE public.employee_onboarding
ADD COLUMN IF NOT EXISTS start_date date null;

-- Force the session to recognize the new column before any subsequent statements
SELECT 1 FROM public.employee_onboarding LIMIT 1;


