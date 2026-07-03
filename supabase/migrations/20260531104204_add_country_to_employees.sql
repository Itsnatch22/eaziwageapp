
-- Add country column to employees
ALTER TABLE public.employees
ADD COLUMN country text;

-- Backfill from employee_onboarding via user_id
UPDATE public.employees e
SET country = eo.country
FROM public.employee_onboarding eo
WHERE eo.user_id = e.user_id
  AND eo.country IS NOT NULL;

