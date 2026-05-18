DO $$
BEGIN
  IF to_regclass('public.employer_onboarding') IS NOT NULL THEN
    ALTER TABLE public.employer_onboarding
      DROP CONSTRAINT IF EXISTS employer_onboarding_status_check;

    ALTER TABLE public.employer_onboarding
      ADD CONSTRAINT employer_onboarding_status_check
      CHECK (
        status = ANY (
          ARRAY[
            'draft'::text,
            'pending'::text,
            'submitted'::text,
            'under_review'::text,
            'risk_review_in_progress'::text,
            'approved'::text,
            'rejected'::text,
            'suspended'::text
          ]
        )
      );
  END IF;
END $$;
