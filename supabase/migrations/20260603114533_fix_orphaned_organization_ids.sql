
-- Fix Odongo employer organization_id
UPDATE public.employers
SET organization_id = '6977d33f-a43c-4334-91ea-a9eef840f09a'
WHERE id = 'd1976efe-6f9e-4819-b2fb-45631cdb89fe';

-- Fix the orphaned employee under Odongo
UPDATE public.employees
SET organization_id = '6977d33f-a43c-4334-91ea-a9eef840f09a'
WHERE employer_id = 'd1976efe-6f9e-4819-b2fb-45631cdb89fe'
  AND organization_id IS NULL;

-- Delete Hustle Sasa - no onboarding, no profile, test data
DELETE FROM public.employers
WHERE id = '486ee304-9de8-49c9-ab12-a37d2de0265a';

