
-- Step 1: Backfill organizations with duplicate-safe slugs
INSERT INTO public.organizations (
  id,
  name,
  slug,
  country_code,
  currency,
  country,
  metadata,
  created_at,
  updated_at
)
SELECT
  eo.id,
  eo.company_name,
  lower(regexp_replace(eo.company_name, '\s+', '-', 'g')) || '-' || substr(eo.id::text, 1, 6),
  COALESCE(eo.country_code, 'KE'),
  COALESCE(eo.currency, 'KES'),
  eo.country,
  COALESCE(eo.settings, '{}'::jsonb),
  eo.created_at,
  eo.updated_at
FROM public.employer_onboarding eo
WHERE eo.status = 'approved'
  AND eo.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 2: Assign organization_id to profiles via employer_onboarding.user_id
UPDATE public.profiles p
SET organization_id = eo.id
FROM public.employer_onboarding eo
WHERE eo.user_id = p.id
  AND eo.status = 'approved'
  AND eo.deleted_at IS NULL
  AND p.organization_id IS NULL;

-- Step 3: Assign organization_id to employees via employer_id
UPDATE public.employees e
SET organization_id = eo.id
FROM public.employer_onboarding eo
WHERE eo.id = e.employer_id
  AND eo.status = 'approved'
  AND eo.deleted_at IS NULL
  AND e.organization_id IS NULL;

