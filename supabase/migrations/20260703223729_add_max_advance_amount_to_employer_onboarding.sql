ALTER TABLE public.employer_onboarding
  ADD COLUMN IF NOT EXISTS max_advance_amount numeric(12,2) NOT NULL DEFAULT 50000;
