
CREATE OR REPLACE FUNCTION public.guard_employer_onboarding_not_deleted()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_employer_onboarding_id uuid;
  v_deleted_at timestamptz;
BEGIN
  -- Use IF/ELSIF instead of CASE so field access is only attempted on the
  -- matching branch (avoids "record NEW has no field onboarding_id" when this
  -- trigger fires on tables that use employer_id rather than onboarding_id).
  IF TG_TABLE_NAME = 'employer_beneficial_owners' THEN
    v_employer_onboarding_id := NEW.onboarding_id;
  ELSE
    v_employer_onboarding_id := NEW.employer_id;
  END IF;

  SELECT deleted_at INTO v_deleted_at
  FROM employer_onboarding
  WHERE id = v_employer_onboarding_id;

  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION
      'Insert rejected: employer_onboarding record (id=%) has been soft-deleted at %. '
      'No new child records may be created for a deleted employer.',
      v_employer_onboarding_id, v_deleted_at;
  END IF;

  RETURN NEW;
END;
$function$;

