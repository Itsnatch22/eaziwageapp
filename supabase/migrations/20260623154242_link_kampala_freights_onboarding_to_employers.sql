
-- Link the existing employers row to its employer_onboarding record
UPDATE employers
SET
  onboarding_id    = '524620a3-3698-4162-97c2-d4408e68954f',
  organization_id  = '524620a3-3698-4162-97c2-d4408e68954f',
  updated_at       = now()
WHERE id = '948cf873-8350-4973-ae41-98b7c300da53'
  AND onboarding_id IS NULL;

-- Also ensure employees under this employer point to the correct employers.id
UPDATE employees
SET employer_id = '948cf873-8350-4973-ae41-98b7c300da53',
    updated_at  = now()
WHERE employer_id = '524620a3-3698-4162-97c2-d4408e68954f';

