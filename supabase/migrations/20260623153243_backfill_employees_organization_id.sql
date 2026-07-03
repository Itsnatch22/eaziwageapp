
-- Backfill missing organization_id from the employers table
UPDATE employees e
SET organization_id = emp.organization_id
FROM employers emp
WHERE e.employer_id = emp.id
  AND e.organization_id IS NULL;

-- Verify no NULLs remain before enforcing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM employees WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION 'organization_id backfill incomplete — NOT NULL not applied';
  END IF;
END $$;

-- Now safe to enforce
ALTER TABLE employees
  ALTER COLUMN organization_id SET NOT NULL;

