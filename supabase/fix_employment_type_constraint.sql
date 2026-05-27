-- Migration: Fix Employment Type Constraints and Data Consistency
-- This script normalizes employment_type values (replacing underscores with hyphens)
-- and adds a check constraint to the onboarding table to match the primary employees table.

-- 1. Fix existing data in employee_onboarding
-- Replaces 'full_time' with 'full-time', etc.
UPDATE public.employee_onboarding 
SET employment_type = REPLACE(employment_type, '_', '-')
WHERE employment_type LIKE '%_%';

-- 2. Fix existing data in employees (in case of any existing drift)
UPDATE public.employees
SET employment_type = REPLACE(employment_type, '_', '-')
WHERE employment_type LIKE '%_%';

-- 3. Add the check constraint to employee_onboarding
-- This prevents future invalid data from entering the sync pipeline
ALTER TABLE public.employee_onboarding
ADD CONSTRAINT employee_onboarding_employment_type_check 
CHECK (employment_type IN ('full-time', 'part-time', 'contract'));

-- 4. Verify existing trigger (Informational)
-- The 'sync_employee_from_onboarding' trigger will now work correctly 
-- because the data being synced will always satisfy the 'employees' table constraints.
