
-- ============================================================
-- STEP 1: Backfill NULL values with safe defaults
-- ============================================================

-- employee_onboarding: risk_level
UPDATE public.employee_onboarding
SET risk_level = 'medium'
WHERE risk_level IS NULL;

-- employee_onboarding: full_name and email from profiles via user_id
UPDATE public.employee_onboarding eo
SET 
  full_name = COALESCE(p.full_name, 'Test Employee'),
  email = COALESCE(p.email::text, 'test@eaziwage.com')
FROM public.profiles p
WHERE eo.user_id = p.id
  AND (eo.full_name IS NULL OR eo.email IS NULL);

-- employee_onboarding: start_date fallback to created_at
UPDATE public.employee_onboarding
SET start_date = created_at::date
WHERE start_date IS NULL;

-- employees: risk_score default to 3.0 (neutral middle)
UPDATE public.employees
SET risk_score = 3.0
WHERE risk_score IS NULL;

-- employees: hire_date fallback to created_at
UPDATE public.employees
SET hire_date = created_at::date
WHERE hire_date IS NULL;

-- employers: risk_score, risk_rating, country
UPDATE public.employers
SET 
  risk_score = COALESCE(risk_score, 3.0),
  risk_rating = COALESCE(risk_rating, 'B'),
  country = COALESCE(country, 'KE')
WHERE risk_score IS NULL OR risk_rating IS NULL OR country IS NULL;

-- profiles: role_normalized sync from role enum
UPDATE public.profiles
SET role_normalized = role::text
WHERE role_normalized IS NULL;

-- ============================================================
-- STEP 2: Enforce NOT NULL constraints on critical columns
-- ============================================================

ALTER TABLE public.employee_onboarding
  ALTER COLUMN risk_level SET NOT NULL,
  ALTER COLUMN risk_level SET DEFAULT 'medium',
  ALTER COLUMN start_date SET NOT NULL;

ALTER TABLE public.employees
  ALTER COLUMN risk_score SET NOT NULL,
  ALTER COLUMN risk_score SET DEFAULT 3.0,
  ALTER COLUMN hire_date SET NOT NULL;

ALTER TABLE public.employers
  ALTER COLUMN risk_score SET NOT NULL,
  ALTER COLUMN risk_score SET DEFAULT 3.0,
  ALTER COLUMN risk_rating SET NOT NULL,
  ALTER COLUMN risk_rating SET DEFAULT 'B',
  ALTER COLUMN country SET NOT NULL;

-- role_normalized: keep nullable (synced from role, not user-facing critical)
-- last_login_at: intentionally nullable — null = never logged in, semantically correct

