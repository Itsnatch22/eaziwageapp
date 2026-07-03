
-- Step 1: Make name nullable (removes the requirement for ad-hoc inserts to supply it)
ALTER TABLE employees ALTER COLUMN name DROP NOT NULL;

-- Step 2: Trigger function that keeps name = full_name always
CREATE OR REPLACE FUNCTION sync_employee_name_from_full_name()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.name := NEW.full_name;
  RETURN NEW;
END;
$$;

-- Step 3: Attach as BEFORE INSERT OR UPDATE on employees
CREATE TRIGGER trg_sync_employee_name
  BEFORE INSERT OR UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION sync_employee_name_from_full_name();

-- Step 4: Backfill any nulls (none expected, but defensive)
UPDATE employees SET name = full_name WHERE name IS DISTINCT FROM full_name;

-- Step 5: Add deprecation comment
COMMENT ON COLUMN employees.name IS
  'Deprecated. Maintained for backward compatibility only. 
   Always mirrors full_name via trg_sync_employee_name trigger. 
   Use full_name for all reads and writes. Candidate for removal in a future migration.';

