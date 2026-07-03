-- Force the view to respect the querying user's RLS instead of running with elevated (creator) privileges
ALTER VIEW public.v_employer_config SET (security_invoker = true);

-- Strip all anon access — this view should never be readable/writable without auth
REVOKE ALL ON public.v_employer_config FROM anon;

-- Authenticated users get SELECT only, gated by RLS on the underlying employers/employer_onboarding tables
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.v_employer_config FROM authenticated;

