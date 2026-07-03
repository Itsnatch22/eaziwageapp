
-- Pass 1: linked via onboarding_id FK
UPDATE employer_onboarding eo
SET company_code = e.company_code
FROM employers e
WHERE e.onboarding_id = eo.id
  AND eo.company_code IS NULL;

-- Pass 2: linked via user_id (no onboarding_id FK yet)
UPDATE employer_onboarding eo
SET company_code = e.company_code
FROM employers e
WHERE e.user_id = eo.user_id
  AND eo.company_code IS NULL;

-- Pass 3: approved/pending/submitted with no employer link — generate deterministically
-- BUG FIX from original: strip [^A-Z0-9a-z] BEFORE UPPER so hex letters (a-f) survive
UPDATE employer_onboarding
SET company_code = UPPER(REGEXP_REPLACE(
  SUBSTRING(id::text FROM 1 FOR 8),
  '[^A-Za-z0-9]', '', 'g'
))
WHERE company_code IS NULL
  AND status IN ('approved', 'pending', 'submitted');

-- Verify: warn if any approved rows still null
DO $$
DECLARE
  null_count integer;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM employer_onboarding
  WHERE company_code IS NULL AND status = 'approved';

  IF null_count > 0 THEN
    RAISE WARNING 'employer_onboarding: % approved rows still have NULL company_code', null_count;
  END IF;
END $$;

