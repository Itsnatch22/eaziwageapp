
-- Issue 11: All 4 employers already have onboarding_id set — safe to enforce.
ALTER TABLE employers ALTER COLUMN onboarding_id SET NOT NULL;

