
CREATE OR REPLACE FUNCTION resolve_live_employer_id(p_ref uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employer_id uuid;
BEGIN
  -- Pass 1: direct employers.id match
  SELECT id INTO v_employer_id FROM public.employers WHERE id = p_ref LIMIT 1;
  IF v_employer_id IS NOT NULL THEN RETURN v_employer_id; END IF;

  -- Pass 2: onboarding_id FK match (canonical)
  SELECT e.id INTO v_employer_id
  FROM public.employers e
  WHERE e.onboarding_id = p_ref
  LIMIT 1;
  IF v_employer_id IS NOT NULL THEN RETURN v_employer_id; END IF;

  -- Pass 3: user_id join via employer_onboarding
  SELECT e.id INTO v_employer_id
  FROM public.employer_onboarding eo
  JOIN public.employers e ON e.user_id = eo.user_id
  WHERE eo.id = p_ref
  LIMIT 1;
  IF v_employer_id IS NOT NULL THEN RETURN v_employer_id; END IF;

  -- Pass 4: employers.employer_id legacy column
  SELECT id INTO v_employer_id FROM public.employers WHERE employer_id = p_ref LIMIT 1;
  IF v_employer_id IS NOT NULL THEN RETURN v_employer_id; END IF;

  -- Nothing found — return NULL, let caller decide
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION resolve_live_employer_id(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION resolve_live_employer_id(uuid) TO authenticated;

