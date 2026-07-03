
-- Auto-provision a default policy row when an employer is created
-- or when their status transitions to 'approved'
CREATE OR REPLACE FUNCTION trg_auto_create_employer_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire on new approved employers or status change to approved
  IF (TG_OP = 'INSERT' AND NEW.status = 'approved')
  OR (TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status <> 'approved')
  THEN
    INSERT INTO policies (employer_id)
    VALUES (NEW.id)
    ON CONFLICT (employer_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_employer_policy_provision
AFTER INSERT OR UPDATE OF status ON employers
FOR EACH ROW
EXECUTE FUNCTION trg_auto_create_employer_policy();

