
-- Step 1: Backfill organization_id from the linked employee record
UPDATE advances a
SET organization_id = e.organization_id
FROM employees e
WHERE a.employee_id = e.id
  AND a.organization_id IS NULL
  AND e.organization_id IS NOT NULL;

-- Step 2: Verify no nulls remain before constraining
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM advances WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION 'advances.organization_id backfill incomplete — NULL rows remain';
  END IF;
END $$;

-- Step 3: Enforce NOT NULL
ALTER TABLE advances
  ALTER COLUMN organization_id SET NOT NULL;

