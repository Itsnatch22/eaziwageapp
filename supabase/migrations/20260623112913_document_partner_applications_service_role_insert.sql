
-- 2.8: Document the intentional absence of a public INSERT policy
COMMENT ON TABLE partner_applications IS
  'Partner application form submissions. INSERT is intentionally restricted to service_role only.
   Public form submissions must go through the Edge Function (e.g. submit-partner-application),
   which validates input, prevents spam, and inserts via the service role client.
   Do NOT add a public INSERT policy — this would bypass validation logic.';

