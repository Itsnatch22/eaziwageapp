
-- ============================================================
-- PHASE 1: Add onboarding_id bridge column to employers
-- ============================================================

-- Step 1: Add the column as nullable first
ALTER TABLE public.employers
  ADD COLUMN onboarding_id uuid NULL;

-- Step 2: Populate from matching user_id
UPDATE public.employers e
SET onboarding_id = eo.id
FROM public.employer_onboarding eo
WHERE e.user_id = eo.user_id;

-- Step 3: Add FK constraint
ALTER TABLE public.employers
  ADD CONSTRAINT employers_onboarding_id_fkey
  FOREIGN KEY (onboarding_id)
  REFERENCES public.employer_onboarding(id)
  ON DELETE SET NULL;

-- Step 4: Add index for join performance
CREATE INDEX idx_employers_onboarding_id 
  ON public.employers(onboarding_id);

