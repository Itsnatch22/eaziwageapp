
-- Backfill: convert stale employer_onboarding.id values → employers.id
UPDATE advances a
SET    employer_id = e.id
FROM   employers e
WHERE  e.onboarding_id = a.employer_id
  AND  a.employer_id IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM employers ev WHERE ev.id = a.employer_id);

-- Guard: abort if any stale rows somehow remain
DO $$
DECLARE
  stale_count integer;
BEGIN
  SELECT COUNT(*) INTO stale_count
  FROM advances a
  WHERE a.employer_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM employers e WHERE e.id = a.employer_id)
    AND EXISTS     (SELECT 1 FROM employers e2 WHERE e2.onboarding_id = a.employer_id);

  IF stale_count > 0 THEN
    RAISE EXCEPTION
      'Backfill incomplete: % advances still reference employer_onboarding.id', stale_count;
  END IF;
END $$;

-- Add FK constraint
ALTER TABLE advances
  ADD CONSTRAINT advances_employer_id_fkey
  FOREIGN KEY (employer_id)
  REFERENCES employers (id)
  ON DELETE SET NULL;

-- Add supporting index
CREATE INDEX IF NOT EXISTS idx_advances_employer_id
  ON advances (employer_id);

