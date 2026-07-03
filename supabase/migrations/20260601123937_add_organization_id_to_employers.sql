
-- Step 1: Add organization_id column to employers
ALTER TABLE employers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Step 2: Populate it by matching on company_name + country
UPDATE employers e
SET organization_id = o.id
FROM organizations o
WHERE LOWER(TRIM(e.company_name)) = LOWER(TRIM(o.name))
  AND (e.country = o.country OR o.country IS NULL);

-- Step 3: Propagate organization_id to employees
UPDATE employees emp
SET organization_id = e.organization_id
FROM employers e
WHERE emp.employer_id = e.id
  AND e.organization_id IS NOT NULL;

-- Step 4: Propagate organization_id to profiles
UPDATE profiles p
SET organization_id = emp.organization_id
FROM employees emp
WHERE p.id = emp.user_id
  AND emp.organization_id IS NOT NULL;

