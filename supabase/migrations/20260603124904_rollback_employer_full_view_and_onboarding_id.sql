
-- Drop the view I created without being asked
DROP VIEW IF EXISTS employer_full;

-- Remove the column I added without being asked
ALTER TABLE employers DROP COLUMN IF EXISTS onboarding_id;

