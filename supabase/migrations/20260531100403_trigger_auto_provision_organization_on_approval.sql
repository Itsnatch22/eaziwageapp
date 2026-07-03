
CREATE OR REPLACE FUNCTION public.handle_employer_onboarding_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status transitions TO 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN

    -- 1. Create organization record if it doesn't already exist
    INSERT INTO public.organizations (
      id,
      name,
      slug,
      country_code,
      currency,
      country,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.company_name,
      lower(regexp_replace(NEW.company_name, '\s+', '-', 'g')) || '-' || substr(NEW.id::text, 1, 6),
      COALESCE(NEW.country_code, 'KE'),
      COALESCE(NEW.currency, 'KES'),
      NEW.country,
      COALESCE(NEW.settings, '{}'::jsonb),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Assign organization_id to the employer's profile
    UPDATE public.profiles
    SET organization_id = NEW.id
    WHERE id = NEW.user_id
      AND organization_id IS NULL;

    -- 3. Assign organization_id to all employees under this employer
    UPDATE public.employees
    SET organization_id = NEW.id
    WHERE employer_id IN (
      SELECT id FROM public.employers WHERE user_id = NEW.user_id
    )
    AND organization_id IS NULL;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to employer_onboarding
DROP TRIGGER IF EXISTS trg_employer_onboarding_approval ON public.employer_onboarding;

CREATE TRIGGER trg_employer_onboarding_approval
AFTER UPDATE ON public.employer_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.handle_employer_onboarding_approval();

