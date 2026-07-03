
-- Migrate the beneficial owner from the older record to the newer one first
UPDATE public.employer_beneficial_owners
SET onboarding_id = '653ad5d9-d97c-4b1b-8e00-079f635eb3ad'
WHERE onboarding_id = 'c028f2ca-8f98-4894-83bc-231783b654c6';

-- Soft delete the older duplicate Naivas record
UPDATE public.employer_onboarding
SET deleted_at = NOW()
WHERE id = 'c028f2ca-8f98-4894-83bc-231783b654c6';

